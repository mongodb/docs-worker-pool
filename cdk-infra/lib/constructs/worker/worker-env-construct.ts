import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getSsmPathPrefix } from '../../utils/ssm';
import { envShortToFullName, getEnv } from '../../utils/env';
import { getCdnInvalidatorUrl } from '../../utils/cdn';
import { getSearchIndexFolder } from '../../utils/search-index';

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

    const fastlyDochubToken = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/dochub/token`);
    const fastlyDochubServiceId = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/dochub/service_id`);
    const fastlyDochubMap = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/dochub_map`);
    const fastlyMainToken = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/main/token`);
    const fastlyMainServiceId = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/fastly/docs/cloudmanager/service_id`
    );
    const fastlyCloudManagerToken = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/fastly/docs/cloudmanager/token`
    );
    const fastlyCloudManagerServiceId = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/fastly/docs/cloudmanager/service_id`
    );
    const fastlyAtlasToken = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/atlas/token`);
    const fastlyAtlasServiceId = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/atlas/service_id`);
    const fastlyOpsManagerToken = StringParameter.valueFromLookup(this, `${ssmPrefix}/fastly/docs/opsmanager/token`);
    const fastlyOpsManagerServiceId = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/fastly/docs/opsmanager/service_id`
    );

    const githubBotUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/bot/username`);
    const githubBotPW = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/bot/password`);
    const githubSecret = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/webhook/secret`);

    const npmBase64Auth = StringParameter.valueFromLookup(this, `${ssmPrefix}/npm/auth`);
    const npmEmail = StringParameter.valueFromLookup(this, `${ssmPrefix}/npm/email`);

    const gatsbyBaseUrl = StringParameter.valueFromLookup(this, `${ssmPrefix}/frontend/base_url`);
    // doing this for the time being, but I think we don't need to necessarily retrieve this from ssm for feature branches, nor would we want to in that case
    const previewBuildEnabled = StringParameter.valueFromLookup(this, `${ssmPrefix}/flag/preview_build/enabled`);
    const entitlementCollection = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/atlas/collections/user/entitlements`
    );
    const repoBranchesCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/repo`);
    const jobCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/job/queue`);
    const cdnClientID = StringParameter.valueFromLookup(this, `${ssmPrefix}/cdn/client/id`);
    const cdnClientSecret = StringParameter.valueFromLookup(this, `${ssmPrefix}/cdn/client/secret`);

    this.environment = {
      STAGE: env,
      SNOOTY_ENV: envShortToFullName(env),
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
      FASTLY_ATLAS_TOKEN: fastlyAtlasToken,
      FASTLY_ATLAS_SERVICE_ID: fastlyAtlasServiceId,
      FASTLY_OPS_MANAGER_TOKEN: fastlyOpsManagerToken,
      FASTLY_OPS_MANAGER_SERVICE_ID: fastlyOpsManagerServiceId,
      FASTLY_CLOUD_MANAGER_TOKEN: fastlyCloudManagerToken,
      FASTLY_CLOUD_MANAGER_SERVICE_ID: fastlyCloudManagerServiceId,
      GITHUB_BOT_USERNAME: githubBotUsername,
      GITHUB_BOT_PASSWORD: githubBotPW,
      GATSBY_BASE_URL: gatsbyBaseUrl,
      PREVIEW_BUILD_ENABLED: previewBuildEnabled,
      NPM_BASE_64_AUTH: npmBase64Auth,
      USER_ENTITLEMENT_COL_NAME: entitlementCollection,
      CDN_CLIENT_ID: cdnClientID,
      CDN_CLIENT_SECRET: cdnClientSecret,
      NPM_EMAIL: npmEmail,
      FASTLY_MAIN_TOKEN: fastlyMainToken,
      FASTLY_MAIN_SERVICE_ID: fastlyMainServiceId,
      REPO_BRANCHES_COLLECTION: repoBranchesCollection,
      JOB_QUEUE_COL_NAME: jobCollection,
      CDN_INVALIDATOR_SERVICE_URL: getCdnInvalidatorUrl(env),
      SEARCH_INDEX_BUCKET: 'docs-search-indexes-test',
      SEARCH_INDEX_FOLDER: getSearchIndexFolder(env),
    };
  }
}
