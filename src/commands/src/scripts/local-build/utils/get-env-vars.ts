import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// This array contains the Parameter Store paths of the secure strings
// we want to add to the worker environment. These are mapped
// to their environment variable name in the workerParamPathToEnvName map.
const workerParamStrings = [
  '/npm/auth',
  '/github/webhook/secret',
  '/github/bot/password',
  '/atlas/password',
  '/fastly/docs/dochub/token',
  '/npm/auth',
  '/fastly/docs/dochub/service_id',
  '/fastly/dochub_map',
  '/fastly/docs/main/token',
  '/fastly/docs/main/service_id',
  '/fastly/docs/cloudmanager/token',
  '/fastly/docs/cloudmanager/service_id',
  '/fastly/docs/atlas/token',
  '/fastly/docs/atlas/service_id',
  '/fastly/docs/opsmanager/token',
  '/fastly/docs/opsmanager/service_id',
  '/cdn/client/id',
  '/cdn/client/secret',
  '/atlas/dbname',
  '/atlas/collections/snooty',
  '/atlas/username',
  '/atlas/host',
  '/flag/preview_webhook_enable',
  '/flag/hide_locale',
  '/flag/use_chatbot',
  '/github/bot/username',
  '/npm/email',
  '/frontend/base_url',
  '/flag/preview_build/enabled',
  '/flag/update_pages',
  '/flag/monorepo_path',
  '/atlas/collections/repo',
  '/atlas/collections/docsets',
  '/atlas/collections/job/queue',
  '/atlas/collections/user/entitlements',
] as const;

type WorkerParamString = (typeof workerParamStrings)[number];
const workerParamPathToEnvName: Record<WorkerParamString, string> = {
  '/npm/auth': 'NPM_BASE_64_AUTH',
  '/github/webhook/secret': 'GITHUB_SECRET',
  '/github/bot/password': 'GITHUB_BOT_PASSWORD',
  '/atlas/password': 'MONGO_ATLAS_PASSWORD',
  '/fastly/docs/dochub/token': 'FASTLY_DOCHUB_TOKEN',
  '/fastly/docs/dochub/service_id': 'FASTLY_DOCHUB_SERVICE_ID',
  '/fastly/dochub_map': 'FASTLY_DOCHUB_MAP',
  '/fastly/docs/main/token': 'FASTLY_MAIN_TOKEN',
  '/fastly/docs/main/service_id': 'FASTLY_MAIN_SERVICE_ID',
  '/fastly/docs/cloudmanager/token': 'FASTLY_CLOUD_MANAGER_TOKEN',
  '/fastly/docs/cloudmanager/service_id': 'FASTLY_CLOUD_MANAGER_SERVICE_ID',
  '/fastly/docs/atlas/token': 'FASTLY_ATLAS_TOKEN',
  '/fastly/docs/atlas/service_id': 'FASTLY_ATLAS_SERVICE_ID',
  '/fastly/docs/opsmanager/token': 'FASTLY_OPS_MANAGER_TOKEN',
  '/fastly/docs/opsmanager/service_id': 'FASTLY_OPS_MANAGER_SERVICE_ID',
  '/cdn/client/id': 'CDN_CLIENT_ID',
  '/cdn/client/secret': 'CDN_CLIENT_SECRET',
  '/atlas/collections/docsets': 'DOCSETS_COL_NAME',
  '/atlas/dbname': 'DB_NAME',
  '/atlas/collections/snooty': 'SNOOTY_DB_NAME',
  '/atlas/username': 'MONGO_ATLAS_USERNAME',
  '/atlas/host': 'MONGO_ATLAS_HOST',
  '/github/bot/username': 'GITHUB_BOT_USERNAME',
  '/frontend/base_url': 'GATSBY_BASE_URL',
  '/flag/preview_build/enabled': 'PREVIEW_BUILD_ENABLED',
  '/flag/update_pages': 'FEATURE_FLAG_UPDATE_PAGES',
  '/flag/monorepo_path': 'FEATURE_FLAG_MONOREPO_PATH',
  '/atlas/collections/user/entitlements': 'USER_ENTITLEMENT_COL_NAME',
  '/npm/email': 'NPM_EMAIL',
  '/atlas/collections/repo': 'REPO_BRANCHES_COL_NAME',
  '/flag/use_chatbot': 'GATSBY_SHOW_CHATBOT',
  '/flag/hide_locale': 'GATSBY_HIDE_UNIFIED_FOOTER_LOCALE',
  '/atlas/collections/job/queue': 'JOB_QUEUE_COL_NAME',
  '/flag/preview_webhook_enable': 'GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED',
};

async function getSecureStrings(
  ssmPrefix: string,
  params: readonly string[],
  paramToEnvMap: Record<string, string>,
  resourceName: string
): Promise<Record<string, string>> {
  const ssmClient = new SSMClient({ region: 'us-east-2' });

  const paramsMap: Record<string, string> = {};

  await Promise.all(
    params.map(async (paramName: string) => {
      const getParamCommand = new GetParameterCommand({
        Name: `${ssmPrefix}${paramName}`,
        WithDecryption: true,
      });

      const ssmResponse = await ssmClient.send(getParamCommand);
      const paramValue = ssmResponse.Parameter?.Value;

      if (!paramValue) {
        console.error(`ERROR! Could not retrieve string for the following param: ${paramName}`);
        return;
      }

      const envName = paramToEnvMap[paramName];

      if (!envName) {
        console.error(
          `ERROR! The param '${paramName}' does not having a mapping to an environment variable name. Please define this in the ${resourceName} map.`
        );
        return;
      }

      paramsMap[envName] = paramValue;
    })
  );

  return paramsMap;
}

const snootyEnvs = ['staging', 'production', 'dotcomstg', 'dotcomprd'] as const;
const autoBuilderEnvs = ['stg', 'prd', 'dev', 'dotcomstg', 'dotcomprd'] as const;

type SnootyEnv = (typeof snootyEnvs)[number];
type AutoBuilderEnv = (typeof autoBuilderEnvs)[number];

const isAutoBuilderEnv = (str: string): str is AutoBuilderEnv => autoBuilderEnvs.includes(str as AutoBuilderEnv);

const autoBuilderToSnootyEnvMap: Record<AutoBuilderEnv, SnootyEnv> = {
  stg: 'staging',
  dev: 'staging',
  prd: 'production',
  dotcomprd: 'dotcomprd',
  dotcomstg: 'dotcomstg',
};

function envShortToFullName(env: string): SnootyEnv {
  if (!isAutoBuilderEnv(env)) throw new Error(`ERROR! ${env} is not a valid env`);

  return autoBuilderToSnootyEnvMap[env];
}
function getCdnInvalidatorUrl(env: AutoBuilderEnv): string {
  return `https://cdnvalidator.${
    env === 'dotcomprd' || env === 'prd' ? 'prod' : 'staging'
  }.staging.corp.mongodb.com/api/v1beta1/distributions/${env}/invalidations`;
}

export async function getWorkerEnv(env: AutoBuilderEnv): Promise<Record<string, string>> {
  const envRecord = await getSecureStrings(
    `/env/${env}/docs/worker_pool`,
    workerParamStrings,
    workerParamPathToEnvName,
    'workerParamPathToEnvName'
  );

  // TODO: Add JOB_UPDATES_QUEUE_URL. Can retrieve with https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cloudformation/command/DescribeStacksCommand/
  return {
    ...envRecord,
    SNOOTY_ENV: envShortToFullName(env),
    SEARCH_INDEX_BUCKET: 'docs-search-indexes-test',
    CDN_INVALIDATOR_SERVICE_URL: getCdnInvalidatorUrl(env),
    MONGO_ATLAS_URL: `mongodb+srv://${envRecord.MONGO_ATLAS_USERNAME}:${envRecord.MONGO_ATLAS_PASSWORD}@${envRecord.MONGO_ATLAS_HOST}/admin?retryWrites=true`,
    STAGE: env,
    MONGO_TIMEOUT_S: '3000',
    IS_LOCAL: 'true',
    ENHANCED: 'true',
    JOB_UPDATES_QUEUE_URL:
      'https://sqs.us-east-2.amazonaws.com/216656347858/auto-builder-stack-enhancedApp-dotcom-queuesJobUpdatesQueue60725415-k32LRG3HnCHm', // temp hardcode
  };
}
