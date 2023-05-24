import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface WebhookEnvConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}
export class WebhookEnvConstruct extends Construct {
  readonly environment: Record<string, string>;

  constructor(scope: Construct, id: string, props: WebhookEnvConstructProps) {
    super(scope, id);

    const dbName = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/dbname');
    const dbUsername = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/username');
    const dbHost = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/host');
    const dbPassword = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/password');
    const slackSecret = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/slack/webhook/secret');
    const slackAuthToken = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/slack/auth/token');

    const fastlyDochubToken = StringParameter.valueFromLookup(
      this,
      '/env/dev/docs/worker_pool/fastly/docs/dochub/token'
    );
    const fastlyDochubServiceId = StringParameter.valueFromLookup(
      this,
      '/env/dev/docs/worker_pool/fastly/docs/dochub/service_id'
    );
    const fastlyDochubMap = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/fastly/dochub_map');
    const githubSecret = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/github/webhook/secret');

    const { jobsQueue, jobUpdatesQueue } = props;

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
