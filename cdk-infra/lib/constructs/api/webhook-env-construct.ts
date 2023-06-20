import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getSsmPathPrefix } from '../../../utils/ssm';

interface WebhookEnvConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
  secureStrings: Record<string, string>;
}
export class WebhookEnvConstruct extends Construct {
  readonly environment: Record<string, string>;

  constructor(scope: Construct, id: string, { jobsQueue, jobUpdatesQueue, secureStrings }: WebhookEnvConstructProps) {
    super(scope, id);

    const ssmPrefix = getSsmPathPrefix();

    const dbName = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/dbname`);
    const dbUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/username`);
    const dbHost = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/host`);
<<<<<<< HEAD
    const jobCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/job/queue`);

    const dbPassword = secureStrings['MONGO_ATLAS_PASSWORD'];
=======

    const dbPassword = secureStrings[`${ssmPrefix}/atlas/password`];
>>>>>>> master
    this.environment = {
      ...secureStrings,
      MONGO_ATLAS_USERNAME: dbUsername,
      MONGO_ATLAS_PASSWORD: dbPassword,
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
<<<<<<< HEAD
      JOB_QUEUE_COL_NAME: jobCollection,
=======

>>>>>>> master
      NODE_CONFIG_DIR: './config',
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
    };
  }
}
