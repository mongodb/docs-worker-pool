import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { Job, JobStatus } from '../../../src/entities/job';
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
  const env = c.get<string>('env');

  const jobRepository = new JobRepository(db, c, consoleLogger);
  const fullDocument = await jobRepository.getJobById(jobId);
  const branchesRepo = new BranchRepository(db, c, consoleLogger);
  const slackMsgs = fullDocument.comMessage;
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
    await prepSummaryMessage(
      env,
      fullDocument,
      branchesRepo,
      repoName,
      limit_message_size(slackMsgs[slackMsgs.length - 1]),
      c.get<string>('dashboardUrl'),
      jobId,
      jobTitle,
      fullDocument.status == 'failed'
    ),
    entitlement['slack_user_id']
  );
  return {
    statusCode: 200,
  };
}

async function extract_url_info(
  env: string,
  repoName: string,
  fullDocument: Job,
  branchesRepo: BranchRepository
): Promise<string> {
  const repo = await branchesRepo.getRepo(repoName);
  const base_url = repo?.url[env];
  let prefix = '';
  if (fullDocument.payload.prefix && fullDocument.payload.prefix !== '') {
    prefix = `/${fullDocument.payload.prefix}`;
  }
  if (fullDocument.payload.jobType == 'githubPush') {
    return repo?.url['stg'] + prefix + '/docsworker-xlarge' + `/${fullDocument.payload.urlSlug}`;
  }
  return base_url + prefix + `/${fullDocument.payload.urlSlug}`;
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

async function prepSummaryMessage(
  env: string,
  fullDocument: Job,
  branchesRepo: BranchRepository,
  repoName: string,
  lastMessage: string,
  jobUrl: string,
  jobId: string,
  jobTitle: string,
  failed = false
): Promise<string> {
  // TODO: Determine why mms-docs has a special lastMessage slicing
  if (repoName === 'mms-docs') {
    lastMessage = `${lastMessage.slice(lastMessage.indexOf('mut-publish'))}\n\n${lastMessage.slice(
      lastMessage.lastIndexOf('Summary')
    )}`;
  }
  const url = await extract_url_info(env, repoName, fullDocument, branchesRepo);
  let msg = '';
  if (failed) {
    msg = `Your Job <${jobUrl}${jobId}|Failed>! Please check the build log for any errors.\n-Repo:*${repoName}*\n- Branch:*${fullDocument.payload.branchName}*\n- Env:*${env}*\n ${lastMessage}\nSorry  :disappointed:! `;
  } else {
    msg = `Your Job <${jobUrl}${jobId}|Completed|>! \n-Repo:*${repoName}*\n- Branch:*${fullDocument.payload.branchName}*\n- Env:*${env}*\n Hosted at ${url} \nEnjoy  :smile:!`;
  }
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
  return {
    statusCode: 200,
  };
}
