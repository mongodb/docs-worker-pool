import * as c from 'config';
import crypto from 'crypto';
import * as mongodb from 'mongodb';
import { IConfig } from 'config';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { GithubCommenter } from '../../../src/services/github';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { Job, JobStatus } from '../../../src/entities/job';
import { ECSContainer } from '../../../src/services/containerServices';
import { SQSConnector } from '../../../src/services/queue';
import { Batch } from '../../../src/services/batch';

// Although data in payload should always be present, it's not guaranteed from
// external callers
interface SnootyPayload {
  jobId?: string;
}

// These options should only be defined if the build summary is being called after
// a Gatsby Cloud job
interface BuildSummaryOptions {
  mongoClient?: mongodb.MongoClient;
  previewUrl?: string;
}

export const TriggerLocalBuild = async (event: any = {}, context: any = {}): Promise<any> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const sqs = new SQSConnector(consoleLogger, c);
  const body = JSON.parse(event.body);
  let resp = {};
  try {
    consoleLogger.info(body.jobId, 'enqueuing Job');
    await sqs.sendMessage(new JobQueueMessage(body.jobId, JobStatus.inQueue), c.get('jobUpdatesQueueUrl'), 0);
    consoleLogger.info(body.jobId, 'Job Queued Job');
    resp = {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: body.jobId,
    };
  } catch (err) {
    consoleLogger.error('TriggerLocalBuild', err);
    resp = {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  } finally {
    await client.close();
    return resp;
  }
};

// TODO: use @types/aws-lambda
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
            if (res) {
              await saveTaskId(jobId, res, consoleLogger);
            }
            consoleLogger.info(jobId, JSON.stringify(res));
            break;
          case JobStatus[JobStatus.inProgress]:
            queueUrl = c.get('jobUpdatesQueueUrl');
            await NotifyBuildProgress(jobId);
            break;
          case JobStatus[JobStatus.timedOut]:
            await NotifyBuildSummary(jobId);
            const taskId = body['taskId'];
            if (taskId) {
              await stopECSTask(taskId, consoleLogger);
            }
            break;
          case JobStatus[JobStatus.failed]:
          case JobStatus[JobStatus.completed]:
            queueUrl = c.get('jobUpdatesQueueUrl');
            await NotifyBuildSummary(jobId);
            await SubmitArchiveJob(jobId);
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

export const FailStuckJobs = async () => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);

  try {
    const hours = 8;
    await jobRepository.failStuckJobs(hours);
  } catch (err) {
    consoleLogger.error('FailStuckJobs', err);
  } finally {
    await client.close();
  }
};

async function saveTaskId(jobId: string, taskExecutionRes: any, consoleLogger: ConsoleLogger): Promise<void> {
  const taskArn = taskExecutionRes?.tasks[0]?.taskArn;
  if (!taskArn) return;

  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const jobRepository = new JobRepository(db, c, consoleLogger);

  try {
    // Only interested in the actual task ID since the whole ARN might have sensitive information
    const taskId = taskArn.split('/').pop();
    await jobRepository.addTaskIdToJob(jobId, taskId);
  } catch (err) {
    consoleLogger.error('saveTaskId', err);
  } finally {
    await client.close();
  }
}

async function stopECSTask(taskId: string, consoleLogger: ConsoleLogger) {
  const ecs = new ECSContainer(c, consoleLogger);
  await ecs.stopZombieECSTask(taskId);
}

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

async function NotifyBuildSummary(jobId: string, options: BuildSummaryOptions = {}): Promise<any> {
  const { mongoClient, previewUrl } = options;
  const consoleLogger = new ConsoleLogger();
  const client: mongodb.MongoClient = mongoClient ?? new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const env = c.get<string>('env');
  const githubToken = c.get<string>('githubBotPW');

  const jobRepository = new JobRepository(db, c, consoleLogger);
  // TODO: Make fullDocument be of type Job, validate existence
  const fullDocument = await jobRepository.getJobById(jobId);
  if (!fullDocument) {
    consoleLogger.error(jobId, 'Cannot find job entry in db');
    return;
  }
  const repoName = fullDocument.payload.repoName;
  const username = fullDocument.user;
  const githubCommenter = new GithubCommenter(consoleLogger, githubToken);
  const slackConnector = new SlackConnector(consoleLogger, c);

  // Create/Update Github comment
  try {
    const parentPRs = await githubCommenter.getParentPRs(fullDocument.payload);
    for (const pr of parentPRs) {
      const prCommentId = await githubCommenter.getPullRequestCommentId(fullDocument.payload, pr);
      const fullJobDashboardUrl = c.get<string>('dashboardUrl') + jobId;

      // We currently avoid posting the Gatsby Cloud preview url on GitHub to avoid
      // potentially conflicting behavior with the S3 staging link with parallel
      // frontend builds. This is in case the GC build finishing first causes the
      // initial comment to be made with a nullish S3 url, while subsequent comment
      // updates only append the list of build logs.
      if (prCommentId !== undefined) {
        const ghMessage = prepGithubComment(fullDocument, fullJobDashboardUrl, true);
        await githubCommenter.updateComment(fullDocument.payload, prCommentId, ghMessage);
      } else {
        const ghMessage = prepGithubComment(fullDocument, fullJobDashboardUrl, false);
        await githubCommenter.postComment(fullDocument.payload, pr, ghMessage);
      }
    }
  } catch (err) {
    consoleLogger.error(jobId, `Failed to comment on GitHub: ${err}`);
  }

  // Slack notification
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getSlackUserIdByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement failed');
    return;
  }
  await slackConnector.sendMessage(
    await prepSummaryMessage(
      env,
      fullDocument,
      repoName,
      c.get<string>('dashboardUrl'),
      jobId,
      fullDocument.status == 'failed',
      previewUrl
    ),
    entitlement['slack_user_id']
  );
  await client.close();
  return {
    statusCode: 200,
  };
}

export const extractUrlFromMessage = (fullDocument): string[] => {
  const { logs } = fullDocument;
  const urls = logs?.length > 0 ? logs.flatMap((log) => log.match(/\bhttps?:\/\/\S+/gi) || []) : [];
  return urls.map((url) => url.replace(/([^:]\/)\/+/g, '$1'));
};

function prepGithubComment(fullDocument: Job, jobUrl: string, isUpdate = false): string {
  if (isUpdate) {
    return `\n* job log: [${fullDocument.payload.newHead}](${jobUrl})`;
  }
  const urls = extractUrlFromMessage(fullDocument);
  let stagingUrl = '';
  if (urls.length > 0) {
    stagingUrl = urls[urls.length - 1];
  }
  return `✨ Staging URL: [${stagingUrl}](${stagingUrl})\n\n#### 🪵 Logs\n\n* job log: [${fullDocument.payload.newHead}](${jobUrl})`;
}

async function prepSummaryMessage(
  env: string,
  fullDocument: Job,
  repoName: string,
  jobUrl: string,
  jobId: string,
  failed = false,
  previewUrl?: string
): Promise<string> {
  const urls = extractUrlFromMessage(fullDocument);
  let mms_urls: Array<string | null> = [null, null];
  // mms-docs needs special handling as it builds two sites (cloudmanager & ops manager)
  // so we need to extract both URLs
  if (repoName === 'mms-docs') {
    if (urls.length >= 2) {
      mms_urls = urls.slice(-2);
    }
  }

  let url = '';
  if (previewUrl) {
    url = previewUrl;
  } else if (urls.length > 0) {
    url = urls[urls.length - 1];
  }

  let msg = '';
  if (failed) {
    msg = `Your Job <${jobUrl}${jobId}|Failed>! Please check the build log for any errors.\n- Repo: *${repoName}*\n- Branch: *${fullDocument.payload.branchName}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env: *${env}*\n Check logs for more errors!!\nSorry  :disappointed:! `;
  } else {
    if (repoName == 'mms-docs') {
      msg = `Your Job <${jobUrl}${jobId}|Completed>! \n- Repo: *${repoName}*\n- Branch: *${fullDocument.payload.branchName}*\n- Commit: *${fullDocument.payload.newHead}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env: *${env}*\n*Urls*\n   *CM*: <${mms_urls[0]}|Cloud Manager> \n   *OPM*: <${mms_urls[1]}|OPS Manager>\n- InvalidationStatus: <${fullDocument.invalidationStatusURL}|Status> \nEnjoy  :smile:!`;
    } else {
      msg = `Your Job <${jobUrl}${jobId}|Completed>! \n- Repo: *${repoName}*\n- Branch: *${fullDocument.payload.branchName}*\n- Commit: *${fullDocument.payload.newHead}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env: *${env}*\n- Url: <${url}|${repoName}>\n- InvalidationStatus: <${fullDocument.invalidationStatusURL}|Status> \nEnjoy  :smile:!`;
    }
  }
  // Remove instances of two or more periods
  return msg.replace(/\.{2,}/g, '');
}

function prepProgressMessage(
  jobUrl: string,
  jobId: string,
  jobTitle: string,
  status: string,
  errorReason: string
): string {
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
      let failedMessage = msg + 'has failed and will not be placed back in the ' + env + ' queue.';
      if (errorReason.match(/Repository not found/)) {
        const autobuilderWikiUrl =
          'https://wiki.corp.mongodb.com/pages/viewpage.action?spaceKey=DE&title=How-To%3A+Use+Snooty%27s+Autobuilder+to+Build+Your+Content#:~:text=origin%20master%3Astage%2Dmaster-,For%20Private%20repositories,-%3A%20in%20addition%20to';
        failedMessage += `\n:point_right: Hint: If your repo is private, have you <${autobuilderWikiUrl}|added the docs-builder-bot as a collaborator?>`;
      }
      return failedMessage;
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
    prepProgressMessage(
      c.get('dashboardUrl'),
      jobId,
      jobTitle,
      fullDocument.status as string,
      fullDocument?.error?.reason || ''
    ),
    entitlement['slack_user_id']
  );
  await client.close();
  return {
    statusCode: 200,
  };
}

function getMongoClient(config: IConfig): mongodb.MongoClient {
  const url = `mongodb+srv://${config.get('dbUsername')}:${config.get('dbPassword')}@${config.get(
    'dbHost'
  )}/?retryWrites=true&w=majority`;
  return new mongodb.MongoClient(url);
}

const STAGING_ENVS = ['stg', 'prd'];

async function SubmitArchiveJob(jobId: string) {
  const consoleLogger = new ConsoleLogger();
  const environment: string = c.get('env');

  if (STAGING_ENVS.includes(environment)) {
    consoleLogger.info('Cancelling archive job for staging', JSON.stringify({ jobId }));
    return;
  }

  const client = getMongoClient(c);

  // TODO: this part should probably be its own function so that we can close the connection
  await client.connect();
  const db = client.db(c.get('dbName'));
  const models = {
    jobs: new JobRepository(db, c, consoleLogger),
    branches: new BranchRepository(db, c, consoleLogger),
  };
  const job = await models.jobs.getJobById(jobId);
  const repo = await models.branches.getRepo(job.payload.repoName);

  /* NOTE
   * we don't archive landing for two reasons:
   * - we can't unless we add efs to batch for extra storage; or https://github.com/aws/containers-roadmap/issues/1383
   * - other properties like realm are nested under s3
   */
  const archiveExclusions = ['docs-landing'];
  if (archiveExclusions.includes(repo.repoName)) return;

  const response = await new Batch(environment).submitArchiveJob(
    repo.bucket[environment],
    `docs-archive-${environment}-mongodb`,
    repo.prefix[environment]
  );
  consoleLogger.info('submit archive job', JSON.stringify({ jobId: jobId, batchJobId: response.jobId }));
  await client.close();
}

/**
 * Checks the signature payload as a rough validation that the request was made by
 * the Snooty frontend.
 * @param payload - stringified JSON payload
 * @param signature - the Snooty signature included in the header
 */
function validateSnootyPayload(payload: string, signature: string) {
  const secret = c.get<string>('snootySecret');
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return signature === expectedSignature;
}

/**
 * Performs post-build operations such as notifications and db updates for job ID
 * provided in its payload. This is typically expected to only be called by
 * Snooty's Gatsby Cloud source plugin.
 * @param event
 * @returns
 */
export async function SnootyBuildComplete(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const consoleLogger = new ConsoleLogger();
  const defaultHeaders = { 'Content-Type': 'text/plain' };

  if (!event.body) {
    const err = 'SnootyBuildComplete does not have a body in event payload';
    consoleLogger.error('SnootyBuildCompleteError', err);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: err,
    };
  }

  // Keep lowercase in case header is automatically converted to lowercase
  // The Snooty frontend should be mindful of using a lowercase header
  const snootySignature = event.headers['x-snooty-signature'];
  if (!snootySignature) {
    const err = 'SnootyBuildComplete does not have a signature in event payload';
    consoleLogger.error('SnootyBuildCompleteError', err);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: err,
    };
  }

  if (!validateSnootyPayload(event.body, snootySignature)) {
    const errMsg = 'Payload signature is incorrect';
    consoleLogger.error('SnootyBuildCompleteError', errMsg);
    return {
      statusCode: 401,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  let payload: SnootyPayload | undefined;
  try {
    payload = JSON.parse(event.body) as SnootyPayload;
  } catch (e) {
    const errMsg = 'Payload is not valid JSON';
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  const { jobId } = payload;
  if (!jobId) {
    const errMsg = 'Payload missing job ID';
    consoleLogger.error('SnootyBuildCompleteError', errMsg);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  const client = new mongodb.MongoClient(c.get('dbUrl'));

  try {
    await client.connect();
    const db = client.db(c.get<string>('dbName'));
    const jobRepository = new JobRepository(db, c, consoleLogger);
    await jobRepository.updateWithCompletionStatus(jobId, null, false);
    // Placeholder preview URL until we iron out the Gatsby Cloud site URLs.
    // This would probably involve fetching the URLs in the db on a per project basis
    const previewUrl = 'https://www.mongodb.com/docs/';
    await NotifyBuildSummary(jobId, { mongoClient: client, previewUrl });
  } catch (e) {
    consoleLogger.error('SnootyBuildCompleteError', e);
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: e,
    };
  } finally {
    await client.close();
  }

  return {
    statusCode: 200,
    headers: defaultHeaders,
    body: `Snooty build ${jobId} completed`,
  };
}
