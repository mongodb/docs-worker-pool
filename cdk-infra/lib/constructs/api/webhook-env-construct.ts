import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getSsmPathPrefix } from '../../../utils/ssm';
import { getDashboardUrl } from '../../../utils/slack';
import { getEnv, getFeatureName } from '../../../utils/env';

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
    const env = getEnv();
    const featureName = getFeatureName();
    console.log('random_change');
    // Create configurable feature flag that lives in parameter store.
    const monorepoPathFeature = new StringParameter(this, 'monorepoPathFeature', {
      parameterName: `${ssmPrefix}/${featureName}/monorepo/path_feature`,
      stringValue: env === 'dotcomstg' || env === 'stg' ? 'true' : 'false',
    });

    const dbName = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/dbname`);
    const snootyDbName = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/snooty`);
    const repoBranchesCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/repo`);
    const dbUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/username`);
    const dbHost = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/host`);
    const jobCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/job/queue`);
    const entitlementCollection = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/atlas/collections/user/entitlements`
    );
    const dbPassword = secureStrings['MONGO_ATLAS_PASSWORD'];
    this.environment = {
      ...secureStrings,
      MONGO_ATLAS_USERNAME: dbUsername,
      MONGO_ATLAS_PASSWORD: dbPassword,
      MONGO_ATLAS_HOST: dbHost,
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
      SNOOTY_DB_NAME: snootyDbName,
      REPO_BRANCHES_COL_NAME: repoBranchesCollection,
      JOB_QUEUE_COL_NAME: jobCollection,
      NODE_CONFIG_DIR: './config',
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
      NODE_OPTIONS: '--enable-source-maps',
      USER_ENTITLEMENT_COL_NAME: entitlementCollection,
      DASHBOARD_URL: getDashboardUrl(env, jobCollection),
      STAGE: env,
      MONOREPO_PATH_FEATURE: monorepoPathFeature.stringValue,
    };
  }
}
