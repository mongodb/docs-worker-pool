import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { JobStatus } from '../../../src/entities/job';
import { ECSContainer } from '../../../src/services/containerServices';
export const HandleJobs = async (event: any = {}): Promise<any> => {
  /**
   * Check the status of the incoming jobs
   * if it is inqueue start a task
   * if it is inprogress call NotifyBuildProgress
   * if it is completed call NotifyBuildSummary
   */

  const messages: JobQueueMessage[] = event.Records;
  await Promise.all(
    messages.map(async (message: JobQueueMessage) => {
      const consoleLogger = new ConsoleLogger();
      switch (message.jobStatus) {
        case JobStatus.inQueue:
          NotifyBuildProgress(message.jobId);
          // start the task , dont start the process before processing the notification
          const ecsServices = new ECSContainer(consoleLogger);
          const res = await ecsServices.execute(message.jobId);
          consoleLogger.info(message.jobId, JSON.stringify(res));
          break;
        case JobStatus.inProgress:
          NotifyBuildProgress(message.jobId);
          break;
        case JobStatus.completed:
        case JobStatus.failed:
          NotifyBuildSummary(message.jobId);
          break;
        default:
          break;
      }
    })
  );
};

async function NotifyBuildSummary(jobId: string): Promise<any> {
  console.log('NotifyBuildSummary', jobId);
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));

  const jobRepository = new JobRepository(db, c, consoleLogger);
  const fullDocument = await jobRepository.getJobById(jobId);

  const slackMsgs = fullDocument.comMessage;
  // check if summary exists to send to slack
  if (!slackMsgs) {
    consoleLogger.error(jobId, 'ERROR: Empty slack message array.');
    return;
  }

  const jobTitle = fullDocument.title;
  const repoName = fullDocument.payload.repoName;
  const username = fullDocument.user;
  const slackConnector = new SlackConnector(consoleLogger, c);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepSummaryMessage(
      repoName,
      limit_message_size(slackMsgs[slackMsgs.length - 1]),
      c.get<string>('dashboardUrl'),
      jobId,
      jobTitle
    ),
    entitlement['slack_user_id']
  );

  console.log(resp);
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
  const msg = `Your Job (<${jobUrl}${jobId}|${jobTitle}>) finished! Please check the build log for any errors.\n${lastMessage}\nEnjoy!`;
  // Removes instances of two or more periods
  return msg.replace(/\.{2,}/g, '');
}

function prepProgressMessage(jobUrl: string, jobId: string, jobTitle: string, status: string): string {
  const msg = `Your Job (<${jobUrl}${jobId}|${jobTitle}>) `;
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
      return msg + 'has been updated to an unsupported status.';
  }
}

async function NotifyBuildProgress(jobId: string): Promise<any> {
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const slackConnector = new SlackConnector(consoleLogger, c);
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const fullDocument = await jobRepository.getJobById(jobId);
  const jobTitle = fullDocument.title;
  const username = fullDocument.user;
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement Failed');
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepProgressMessage(c.get('dashboardUrl'), jobId, jobTitle, fullDocument.status),
    entitlement['slack_user_id']
  );
  console.log(resp);
  return {
    statusCode: 200,
  };
}
