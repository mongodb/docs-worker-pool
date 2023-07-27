import * as c from 'config';
import * as mongodb from 'mongodb';
import { IConfig } from 'config';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { JobQueueMessage } from '../../../src/entities/queueMessage';
import { Job, JobStatus } from '../../../src/entities/job';
import { ECSContainer } from '../../../src/services/containerServices';
import { SQSConnector } from '../../../src/services/queue';
import { Batch } from '../../../src/services/batch';
import { APIGatewayEvent, APIGatewayProxyResult, SQSEvent, SQSRecord } from 'aws-lambda';
import { notifyBuildSummary, snootyBuildComplete } from '../../handlers/jobs';

export const TriggerLocalBuild = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const consoleLogger = new ConsoleLogger();
  const sqs = new SQSConnector(consoleLogger, c);

  if (!event.body) {
    const err = 'Trigger local build does not have a body in event payload';
    consoleLogger.error('TriggerLocalBuildError', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }

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

export const HandleJobs = async (event: SQSEvent): Promise<void> => {
  /**
   * Check the status of the incoming jobs
   * if it is inqueue start a task
   * if it is inprogress call NotifyBuildProgress
   * if it is completed call NotifyBuildSummary
   */
  const messages = event.Records;
  await Promise.all(
    messages.map(async (message: SQSRecord) => {
      const consoleLogger = new ConsoleLogger();
      console.log('SQS RECORD: ', message);
      const body = JSON.parse(message.body);
      const jobId = body['jobId'];
      const jobStatus = body['jobStatus'];

      try {
        switch (jobStatus) {
          case JobStatus[JobStatus.inProgress]:
            await NotifyBuildProgress(jobId);
            break;
          case JobStatus[JobStatus.timedOut]:
            await notifyBuildSummary(jobId);
            const taskId = body['taskId'];
            // for the enhanced application, the taskId will never be defined
            // as we are not saving it at this time
            if (taskId) {
              await stopECSTask(taskId, consoleLogger);
            }
            break;
          case JobStatus[JobStatus.failed]:
          case JobStatus[JobStatus.completed]:
            await Promise.all([notifyBuildSummary(jobId), SubmitArchiveJob(jobId)]);
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

async function stopECSTask(taskId: string, consoleLogger: ConsoleLogger) {
  const ecs = new ECSContainer(c, consoleLogger);
  await ecs.stopZombieECSTask(taskId);
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

async function NotifyBuildProgress(jobId: string): Promise<void> {
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const slackConnector = new SlackConnector(consoleLogger, c);
  const jobRepository = new JobRepository(db, c, consoleLogger);

  const fullDocument = await jobRepository.getJobById(jobId);

  if (!fullDocument) {
    consoleLogger.error(
      `NotifyBuildProgress_${jobId}`,
      `Notify build progress failed. Job does not exist for Job ID: ${jobId}`
    );
    return;
  }

  const jobTitle = fullDocument.title;
  const username = fullDocument.user;
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getSlackUserIdByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement Failed');
    return;
  }

  await slackConnector.sendMessage(
    prepProgressMessage(
      c.get('dashboardUrl'),
      jobId,
      jobTitle,
      fullDocument.status as string,
      fullDocument?.error?.reason || ''
    ),
    entitlement['slack_user_id']
  );
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

  if (!job) {
    consoleLogger.error(
      `SubmitArchiveJob_${jobId}`,
      `Submit archive job failed. Job does not exist for Job ID: ${jobId}`
    );
    return;
  }

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

export const SnootyBuildComplete = snootyBuildComplete;
