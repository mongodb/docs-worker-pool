import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { getCdnInvalidatorUrl } from '../../../utils/cdn';
<<<<<<< HEAD
import { getEnv, envShortToFullName, getIsEnhanced } from '../../../utils/env';
=======
import { getEnv, envShortToFullName } from '../../../utils/env';
>>>>>>> master
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
    const dbUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/username`);
    const dbHost = StringParameter.valueFromLookup(this, `${ssmPrefix}/atlas/host`);

    const githubBotUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/bot/username`);

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

<<<<<<< HEAD
    const dbPassword = secureStrings['MONGO_ATLAS_PASSWORD'];
=======
    const dbPassword = secureStrings[`${ssmPrefix}/atlas/password`];

>>>>>>> master
    this.environment = {
      ...secureStrings,
      STAGE: env,
      SNOOTY_ENV: envShortToFullName(env),
      MONGO_ATLAS_USERNAME: dbUsername,
<<<<<<< HEAD
      MONGO_ATLAS_HOST: dbHost,
=======
>>>>>>> master
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
      GITHUB_BOT_USERNAME: githubBotUsername,
      GATSBY_BASE_URL: gatsbyBaseUrl,
      PREVIEW_BUILD_ENABLED: previewBuildEnabled,
      USER_ENTITLEMENT_COL_NAME: entitlementCollection,
      NPM_EMAIL: npmEmail,
<<<<<<< HEAD
      REPO_BRANCHES_COL_NAME: repoBranchesCollection,
=======
      REPO_BRANCHES_COLLECTION: repoBranchesCollection,
>>>>>>> master
      JOB_QUEUE_COL_NAME: jobCollection,
      CDN_INVALIDATOR_SERVICE_URL: getCdnInvalidatorUrl(env),
      SEARCH_INDEX_BUCKET: 'docs-search-indexes-test',
      SEARCH_INDEX_FOLDER: getSearchIndexFolder(env),
<<<<<<< HEAD
      ENHANCED: `${getIsEnhanced()}`,
=======
>>>>>>> master
    };
  }
}
