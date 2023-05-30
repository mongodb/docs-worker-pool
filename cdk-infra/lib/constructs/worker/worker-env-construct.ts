import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getSsmPathPrefix } from '../../utils/ssm';
import { getEnv } from '../../utils/env';

interface WorkerEnvConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}

export class WorkerEnvConstruct extends Construct {
  readonly environment: Record<string, string>;

  constructor(scope: Construct, id: string, { jobsQueue, jobUpdatesQueue }: WorkerEnvConstructProps) {
    super(scope, id);

    const env = getEnv(this);

    const ssmPrefix = getSsmPathPrefix(env);

    const dbName = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/dbname`);
    const dbUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/username`);
    const dbHost = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/host`);
    const dbPassword = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/password`);

    const githubBotUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/bot/username`);

    const fastlyDochubToken = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/dochub/token`);
    const fastlyDochubServiceId = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/dochub/service_id`);
    const fastlyDochubMap = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/dochub_map`);
    const githubSecret = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/webhook/secret`);

    this.environment = {
      GITHUB_SECRET: githubSecret,
      MONGO_ATLAS_USERNAME: dbUsername,
      MONGO_ATLAS_PASSWORD: dbPassword,
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
      NODE_CONFIG_DIR: './config',
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
      FASTLY_DOCHUB_MAP: fastlyDochubMap,
      FASTLY_DOCHUB_SERVICE_ID: fastlyDochubServiceId,
      FASTLY_DOCHUB_TOKEN: fastlyDochubToken,
    };
  }
}
