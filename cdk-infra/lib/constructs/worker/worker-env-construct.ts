import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getCdnInvalidatorUrl } from '../../../utils/cdn';
import {
  getEnv,
  envShortToFullName,
  getIsEnhanced,
  getUseCustomBuckets,
  getFeatureName,
  getIsFeatureBranch,
} from '../../../utils/env';
import { getSearchIndexFolder } from '../../../utils/search-index';
import { getSsmPathPrefix } from '../../../utils/ssm';

interface WorkerEnvConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
  secureStrings: Record<string, string>;
}

export class WorkerEnvConstruct extends Construct {
  readonly environment: Record<string, string>;

  constructor(scope: Construct, id: string, { jobsQueue, jobUpdatesQueue, secureStrings }: WorkerEnvConstructProps) {
    super(scope, id);

    const env = getEnv();
    const ssmPrefix = getSsmPathPrefix();

    const dbName = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/dbname`);
    const snootyDbName = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/snooty`);
    const dbUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/username`);
    const dbHost = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/host`);

    // adds the feature flag & POST URL
    const gatsbyCloudPreviewWebhookFeature = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/flag/preview_webhook_enable`
    );
    const gatsbyCloudPreviewWebhookURL = StringParameter.valueFromLookup(
      this,
      `/docs/worker_pool/preview_webhook/snooty_gatsby_cloud_test/data_source`
    );

    // font-end feature flag for unified footer locale selector
    const gatsbyHideUnifiedFooterLocale = StringParameter.valueFromLookup(this, `${ssmPrefix}/flag/hide_locale`);

    const githubBotUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/bot/username`);

    const npmEmail = StringParameter.valueFromLookup(this, `${ssmPrefix}/npm/email`);

    const gatsbyBaseUrl = StringParameter.valueFromLookup(this, `${ssmPrefix}/frontend/base_url`);
    // doing this for the time being, but I think we don't need to necessarily retrieve this from ssm for feature branches, nor would we want to in that case
    const previewBuildEnabled = StringParameter.valueFromLookup(this, `${ssmPrefix}/flag/preview_build/enabled`);
    const featureFlagUpdatePages = StringParameter.valueFromLookup(this, `${ssmPrefix}/flag/update_pages`);
    const featureFlagMonorepoPath = StringParameter.valueFromLookup(this, `${ssmPrefix}/flag/monorepo_path`);

    const entitlementCollection = StringParameter.valueFromLookup(
      this,
      `${ssmPrefix}/atlas/collections/user/entitlements`
    );
    const repoBranchesCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/repo`);
    const docsetsCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/docsets`);
    const jobCollection = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/collections/job/queue`);
    const gatsbyMarianUrl = StringParameter.valueFromLookup(this, `${ssmPrefix}/frontend/marian_url`);

    const dbPassword = secureStrings['MONGO_ATLAS_PASSWORD'];
    this.environment = {
      ...secureStrings,
      STAGE: env,
      GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED: gatsbyCloudPreviewWebhookFeature,
      GATSBY_CLOUD_PREVIEW_WEBHOOK_URL: gatsbyCloudPreviewWebhookURL,
      SNOOTY_ENV: envShortToFullName(env),
      MONGO_ATLAS_USERNAME: dbUsername,
      MONGO_ATLAS_HOST: dbHost,
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
      SNOOTY_DB_NAME: snootyDbName,
      METADATA_DB_NAME: 'docs_metadata',
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
      GITHUB_BOT_USERNAME: githubBotUsername,
      GATSBY_BASE_URL: gatsbyBaseUrl,
      PREVIEW_BUILD_ENABLED: previewBuildEnabled,
      FEATURE_FLAG_UPDATE_PAGES: featureFlagUpdatePages,
      FEATURE_FLAG_MONOREPO_PATH: featureFlagMonorepoPath,
      USER_ENTITLEMENT_COL_NAME: entitlementCollection,
      NPM_EMAIL: npmEmail,
      REPO_BRANCHES_COL_NAME: repoBranchesCollection,
      DOCSETS_COL_NAME: docsetsCollection,
      JOB_QUEUE_COL_NAME: jobCollection,
      PROJECTS_COL_NAME: 'projects',
      CDN_INVALIDATOR_SERVICE_URL: getCdnInvalidatorUrl(env),
      SEARCH_INDEX_BUCKET: 'docs-search-indexes-test',
      SEARCH_INDEX_FOLDER: getSearchIndexFolder(env),
      ENHANCED: `${getIsEnhanced()}`,
      USE_CUSTOM_BUCKETS: `${getUseCustomBuckets()}`,
      FEATURE_NAME: getFeatureName(),
      GATSBY_TEST_SEARCH_UI: 'false',
      GATSBY_HIDE_UNIFIED_FOOTER_LOCALE: gatsbyHideUnifiedFooterLocale,
      GATSBY_MARIAN_URL: gatsbyMarianUrl,
      IS_FEATURE_BRANCH: getIsFeatureBranch(),
    };
  }
}
