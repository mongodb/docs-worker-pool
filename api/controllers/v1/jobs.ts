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

export const TriggerLocalBuild = async (event: any = {}, context: any = {}): Promise<any> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const sqs = new SQSConnector(consoleLogger, c);
  const body = JSON.parse(event.body);
  try {
    consoleLogger.info(body.jobId, 'enqueuing Job');
    await sqs.sendMessage(new JobQueueMessage(body.jobId, JobStatus.inQueue), c.get('jobUpdatesQueueUrl'), 0);
    consoleLogger.info(body.jobId, 'Job Queued Job');
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: body.jobId,
    };
  } catch (err) {
    consoleLogger.error('TriggerLocalBuild', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }
};

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
            // start the task , don't start the process before processing the notification
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
        throw err;
      }
    })
  );
};

async function retry(message: JobQueueMessage, consoleLogger: ConsoleLogger, url: string): Promise<any> {
  try {
    const tries = message.tries;
    // TODO: c.get('maxRetries') is of type 'Unknown', needs validation
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
  // TODO: Make fullDocument be of type Job, validate existence
  const fullDocument = await jobRepository.getJobById(jobId);
  // TODO: Remove unused vars, and validate existing vars
  const branchesRepo = new BranchRepository(db, c, consoleLogger);
  const slackMsgs = fullDocument.comMessage;
  const jobTitle = fullDocument.title;
  const repoName = fullDocument.payload.repoName;
  const username = fullDocument.user;
  const slackConnector = new SlackConnector(consoleLogger, c);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getSlackUserIdByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement failed');
    return;
  }
  const resp = await slackConnector.sendMessage(
    await prepSummaryMessage(
      env,
      fullDocument,
      repoName,
      c.get<string>('dashboardUrl'),
      jobId,
      fullDocument.status == 'failed'
    ),
    entitlement['slack_user_id']
  );
  return {
    statusCode: 200,
  };
}

export const extractUrlFromMessage = (fullDocument): string[] => {
  const { logs } = fullDocument;
  const urls = logs?.length > 0 ? logs.flatMap((log) => log.match(/\bhttps?:\/\/\S+/gi) || []) : [];
  return urls.map((url) => url.replace(/([^:]\/)\/+/g, '$1'));
};

async function prepSummaryMessage(
  env: string,
  fullDocument: Job,
  repoName: string,
  jobUrl: string,
  jobId: string,
  failed = false
): Promise<string> {
  const urls = extractUrlFromMessage(fullDocument);
  let mms_urls = [null, null];
  // mms-docs needs special handling as it builds two sites (cloudmanager & ops manager)
  // so we need to extract both URLs
  if (repoName === 'mms-docs') {
    if (urls.length >= 2) {
      // TODO: Type 'string[]' is not assignable to type 'null[]'.
      mms_urls = urls.slice(-2);
    }
  }
  let url = '';
  if (urls.length > 0) {
    url = urls[urls.length - 1];
  }
  let msg = '';
  if (failed) {
    msg = `Your Job <${jobUrl}${jobId}|Failed>! Please check the build log for any errors.\n- Repo:*${repoName}*\n- Branch:*${fullDocument.payload.branchName}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env:*${env}*\n Check logs for more errors!!\nSorry  :disappointed:! `;
  } else {
    if (repoName == 'mms-docs') {
      msg = `Your Job <${jobUrl}${jobId}|Completed>! \n- Repo:*${repoName}*\n- Branch:*${fullDocument.payload.branchName}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env:*${env}*\n*Urls*\n   *CM*:<${mms_urls[0]}|Cloud Manager> \n   *OPM*:<${mms_urls[1]}|OPS Manager>\n- InvalidationStatus:<${fullDocument.invalidationStatusURL}|Status> \nEnjoy  :smile:!`;
    } else {
      msg = `Your Job <${jobUrl}${jobId}|Completed>! \n- Repo:*${repoName}*\n- Branch:*${fullDocument.payload.branchName}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env:*${env}*\n- Url:<${url}|${repoName}>\n- InvalidationStatus:<${fullDocument.invalidationStatusURL}|Status> \nEnjoy  :smile:!`;
    }
  }
  // Remove instances of two or more periods
  return msg.replace(/\.{2,}/g, '');
}

function prepProgressMessage(jobUrl: string, jobId: string, jobTitle: string, status: string): string {
  const msg = `Your Job (<${jobUrl}${jobId}|${jobTitle}>) `;
  const env = c.get<string>('env');
  switch (status) {
    case 'inQueue':
      return msg + 'has successfully been added to the ' + env + ' queue.';
    case 'inProgress':
      return msg + 'is now being processed.';
    case 'completed':
      return msg + 'has successfully completed.';
    case 'failed':
      return msg + 'has failed and will not be placed back in the ' + env + ' queue.';
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
  // TODO: Make fullDocument be of type Job, validate existence
  const fullDocument = await jobRepository.getJobById(jobId);
  const jobTitle = fullDocument.title;
  const username = fullDocument.user;
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getSlackUserIdByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement Failed');
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepProgressMessage(c.get('dashboardUrl'), jobId, jobTitle, fullDocument.status as string),
    entitlement['slack_user_id']
  );
  return {
    statusCode: 200,
  };
}
