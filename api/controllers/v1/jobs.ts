import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { JobStatus } from '../../../src/entities/job';
import { ECSContainer } from '../../../src/services/containerServices';
import { SQSConnector } from '../../../src/services/queue';

export const HandleJobs = async (event: any = {}): Promise<any> => {
  /**
   * Check the status of the incoming jobs
   * if it is inqueue start a task
   * if it is inprogress call NotifyBuildProgress
   * if it is completed call NotifyBuildSummary
   */
  const messages: JobQueueMessage[] = event.Records;
  await Promise.all(
    messages.map(async (message: any) => {
      const consoleLogger = new ConsoleLogger();
      const body = JSON.parse(message.body);
      let queueUrl = '';
      const jobId = body['jobId'];
      const jobStatus = body['jobStatus'];
      try {
        // TODO: possible to switch to type map inference?
        switch (jobStatus) {
          case JobStatus[JobStatus.inQueue]:
            queueUrl = c.get('jobsQueueUrl');
            await NotifyBuildProgress(jobId);
            // start the task , dont start the process before processing the notification
            const ecsServices = new ECSContainer(c, consoleLogger);
            const res = await ecsServices.execute(jobId);
            consoleLogger.info(jobId, JSON.stringify(res));
            break;
          case JobStatus[JobStatus.inProgress]:
            queueUrl = c.get('jobUpdatesQueueUrl');
            await NotifyBuildProgress(jobId);
            break;
          case JobStatus[JobStatus.failed]:
          case JobStatus[JobStatus.completed]:
            queueUrl = c.get('jobUpdatesQueueUrl');
            await NotifyBuildProgress(jobId);
            await NotifyBuildSummary(jobId);
            break;
          default:
            consoleLogger.error(jobId, 'Invalid status');
            break;
        }
      } catch (err) {
        consoleLogger.error(jobId, err);
        await retry(body, consoleLogger, queueUrl);
      }
    })
  );
};

async function retry(message: JobQueueMessage, consoleLogger: ConsoleLogger, url: string): Promise<any> {
  try {
    const tries = message.tries;
    if (tries < c.get('maxRetries')) {
      const sqs = new SQSConnector(consoleLogger, c);
      message['tries'] += 1;
      let retryDelay = 10;
      if (c.get('retryDelay')) {
        retryDelay = c.get('retryDelay');
      }
      await sqs.sendMessage(message, url, retryDelay * tries);
    }
  } catch (err) {
    consoleLogger.error(message['jobId'], err);
  }
}
async function NotifyBuildSummary(jobId: string): Promise<any> {
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));

  const jobRepository = new JobRepository(db, c, consoleLogger);
  const job = await jobRepository.getJobById(jobId);

  // TODO: What is this supposed to reference, job.result?
  const slackMsgs = '';
  const slackConnector = new SlackConnector(consoleLogger, c);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job?.user);
  if (!entitlement?.['slack_user_id']) {
    return;
  }
  // TODO: Where is this supposed to be used?
  const resp = await slackConnector.sendMessage(
    prepSummaryMessage(
      job?.payload?.repoName,
      limit_message_size(slackMsgs[slackMsgs.length - 1]),
      c.get<string>('dashboardUrl'),
      jobId,
      job?.title
    ),
    entitlement['slack_user_id']
  );
  return {
    statusCode: 200,
  };
}

function limit_message_size(message) {
  while (message.length >= 256) {
    let end = 255;
    while (message[end] != ' ') {
      end -= 1;
    }
    message = message.substring(0, end + 1);
  }
  return message;
}

function prepSummaryMessage(
  repoName: string,
  lastMessage: string,
  jobUrl: string,
  jobId: string,
  jobTitle: string
): string {
  // TODO: Determine why mms-docs has a special lastMessage slicing
  if (repoName === 'mms-docs') {
    lastMessage = `${lastMessage.slice(lastMessage.indexOf('mut-publish'))}\n\n${lastMessage.slice(
      lastMessage.lastIndexOf('Summary')
    )}`;
  }
  const msg = `Your job (<${jobUrl}${jobId}|${jobTitle}>) finished! Please check the build log for any errors.\n${lastMessage}\nEnjoy!`;
  // Removes instances of two or more periods
  return msg.replace(/\.{2,}/g, '');
}

function prepProgressMessage(jobUrl: string, jobId: string, jobTitle: string, status: string): string {
  const msg = `Your job (<${jobUrl}${jobId}|${jobTitle}>) `;
  switch (status) {
    case 'inQueue':
      return msg + 'has successfully been added to the queue.';
    case 'inProgress':
      return msg + 'is now being processed.';
    case 'completed':
      return msg + 'has successfully completed.';
    case 'failed':
      return msg + 'has failed and will not be placed back in the queue.';
    default:
      return msg + `has been updated to unsupported status '${status}'.`;
  }
}

async function NotifyBuildProgress(jobId: string): Promise<any> {
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const slackConnector = new SlackConnector(consoleLogger, c);
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const job = await jobRepository.getJobById(jobId);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job?.user);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(job?.user, 'Entitlement Failed');
    return;
  }
  // TODO: Where is this supposed to be used?
  const resp = await slackConnector.sendMessage(
    prepProgressMessage(c.get('dashboardUrl'), jobId, job?.title, job?.status),
    entitlement['slack_user_id']
  );
  return {
    statusCode: 200,
  };
}
