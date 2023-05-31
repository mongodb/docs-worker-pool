import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getEnv } from '../../../utils/env';
import { getSsmPathPrefix } from '../../../utils/ssm';

interface WebhookEnvConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}
export class WebhookEnvConstruct extends Construct {
  readonly environment: Record<string, string>;

  constructor(scope: Construct, id: string, { jobsQueue, jobUpdatesQueue }: WebhookEnvConstructProps) {
    super(scope, id);

    const env = getEnv(this);
    const ssmPathPrefix = getSsmPathPrefix(env);

    const dbName = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/atlas/dbname`);
    const dbUsername = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/atlas/username`);
    const dbHost = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/atlas/host`);
    const dbPassword = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/atlas/password`);
    const slackSecret = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/slack/webhook/secret`);
    const slackAuthToken = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/slack/auth/token`);

    const fastlyDochubToken = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/fastly/docs/dochub/token`);
    const fastlyDochubServiceId = StringParameter.valueFromLookup(
      this,
      `${ssmPathPrefix}/fastly/docs/dochub/service_id`
    );
    const fastlyDochubMap = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/fastly/dochub_map`);
    const githubSecret = StringParameter.valueFromLookup(this, `${ssmPathPrefix}/github/webhook/secret`);

    this.environment = {
      GITHUB_SECRET: githubSecret,
      MONGO_ATLAS_USERNAME: dbUsername,
      MONGO_ATLAS_PASSWORD: dbPassword,
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
      SLACK_SECRET: slackSecret,
      SLACK_TOKEN: slackAuthToken,
      NODE_CONFIG_DIR: './api/config',
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
      FASTLY_DOCHUB_MAP: fastlyDochubMap,
      FASTLY_DOCHUB_SERVICE_ID: fastlyDochubServiceId,
      FASTLY_DOCHUB_TOKEN: fastlyDochubToken,
    };
  }
}
