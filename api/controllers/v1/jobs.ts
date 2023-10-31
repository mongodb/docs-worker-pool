import * as c from 'config';
import * as mongodb from 'mongodb';
import { IConfig } from 'config';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { JobStatus } from '../../../src/entities/job';
import { ECSContainer } from '../../../src/services/containerServices';
import { SQSConnector } from '../../../src/services/queue';
import { Batch } from '../../../src/services/batch';
import { notifyBuildSummary, snootyBuildComplete } from '../../handlers/jobs';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';

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
            await notifyBuildSummary(jobId);
            const taskId = body['taskId'];
            if (taskId) {
              await stopECSTask(taskId, consoleLogger);
            }
            break;
          case JobStatus[JobStatus.failed]:
          case JobStatus[JobStatus.completed]:
            queueUrl = c.get('jobUpdatesQueueUrl');
            await notifyBuildSummary(jobId);
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

function prepProgressMessage(
  jobUrl: string,
  jobId: string,
  jobTitle: string,
  status: string,
  errorReason: string,
  jobType?: string
): string {
  const msg = `Your Job (<${jobUrl}${jobId}|${jobTitle}>) `;
  const env = c.get<string>('env');
  switch (status) {
    case 'inQueue':
      // Encourage writers to update to new webhook on githubPush jobs
      let inQueueMsg = msg;
      if (jobType == 'githubPush') {
        const webhookWikiUrl =
          'https://wiki.corp.mongodb.com/display/DE/How-To%3A+Use+Snooty%27s+Autobuilder+to+Build+Your+Content';
        const updatePlease = `:exclamation: You used the old webhook for this build. <${webhookWikiUrl}|Update to the new webhook> in your fork of this repo to save 90s per build.`;
        inQueueMsg = updatePlease + '\n\n' + msg;
      }
      return inQueueMsg + 'has successfully been added to the ' + env + ' queue.';
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
      fullDocument?.error?.reason || '',
      fullDocument?.payload.jobType
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
    repoBranches: new DocsetsRepository(db, c, consoleLogger),
  };
  const job = await models.jobs.getJobById(jobId);
  const repo = await models.repoBranches.getRepo(job.payload.repoName, job?.payload.directory);

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

export const SnootyBuildComplete = snootyBuildComplete;
