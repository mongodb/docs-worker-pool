import * as c from 'config';
import * as mongodb from 'mongodb';
import { IConfig } from 'config';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { GithubConnector } from '../../../src/services/github';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { Job, JobStatus } from '../../../src/entities/job';
import { ECSContainer } from '../../../src/services/containerServices';
import { SQSConnector } from '../../../src/services/queue';
import { Batch } from '../../../src/services/batch';

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
async function NotifyBuildSummary(jobId: string): Promise<any> {
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const env = c.get<string>('env');
  const githubToken = c.get<string>('githubBotPW');

  const jobRepository = new JobRepository(db, c, consoleLogger);
  // TODO: Make fullDocument be of type Job, validate existence
  const fullDocument = await jobRepository.getJobById(jobId);
  if (!fullDocument) {
    consoleLogger.error('Cannot find job entry in db', '');
    return;
  }
  const repoName = fullDocument.payload.repoName;
  const username = fullDocument.user;
  const githubConnector = new GithubConnector(consoleLogger, c, githubToken);
  const slackConnector = new SlackConnector(consoleLogger, c);

  // Github comment
  await githubConnector.getParentPRs(fullDocument.payload).then(function (results) {
    for (const pr of results) {
      githubConnector.getPullRequestCommentId(fullDocument.payload, pr).then(function (id) {
        console.log(`The comment ID is: ${id}`);
        const fullDashboardUrl = c.get<string>('dashboardUrl') + jobId;
        if (id != undefined) {
          prepGithubComment(fullDocument, fullDashboardUrl, true).then(function (ghmessage) {
            githubConnector.updateComment(fullDocument.payload, id, ghmessage);
          });
        } else {
          prepGithubComment(fullDocument, fullDashboardUrl, false).then(function (ghmessage) {
            githubConnector.postComment(fullDocument.payload, pr, ghmessage);
          });
        }
      });
    }
  });

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

async function prepGithubComment(fullDocument: Job, jobUrl: string, isUpdate = false): Promise<string> {
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
}
