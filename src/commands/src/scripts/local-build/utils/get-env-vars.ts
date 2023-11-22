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
const workerParamPathToEnvName = new Map<WorkerParamString, string>();

workerParamPathToEnvName.set('/npm/auth', 'NPM_BASE_64_AUTH');
workerParamPathToEnvName.set('/github/webhook/secret', 'GITHUB_SECRET');
workerParamPathToEnvName.set('/github/bot/password', 'GITHUB_BOT_PASSWORD');
workerParamPathToEnvName.set('/atlas/password', 'MONGO_ATLAS_PASSWORD');
workerParamPathToEnvName.set('/fastly/docs/dochub/token', 'FASTLY_DOCHUB_TOKEN');
workerParamPathToEnvName.set('/fastly/docs/dochub/service_id', 'FASTLY_DOCHUB_SERVICE_ID');
workerParamPathToEnvName.set('/fastly/dochub_map', 'FASTLY_DOCHUB_MAP');
workerParamPathToEnvName.set('/fastly/docs/main/token', 'FASTLY_MAIN_TOKEN');
workerParamPathToEnvName.set('/fastly/docs/main/service_id', 'FASTLY_MAIN_SERVICE_ID');
workerParamPathToEnvName.set('/fastly/docs/cloudmanager/token', 'FASTLY_CLOUD_MANAGER_TOKEN');
workerParamPathToEnvName.set('/fastly/docs/cloudmanager/service_id', 'FASTLY_CLOUD_MANAGER_SERVICE_ID');
workerParamPathToEnvName.set('/fastly/docs/atlas/token', 'FASTLY_ATLAS_TOKEN');
workerParamPathToEnvName.set('/fastly/docs/atlas/service_id', 'FASTLY_ATLAS_SERVICE_ID');
workerParamPathToEnvName.set('/fastly/docs/opsmanager/token', 'FASTLY_OPS_MANAGER_TOKEN');
workerParamPathToEnvName.set('/fastly/docs/opsmanager/service_id', 'FASTLY_OPS_MANAGER_SERVICE_ID');
workerParamPathToEnvName.set('/cdn/client/id', 'CDN_CLIENT_ID');
workerParamPathToEnvName.set('/cdn/client/secret', 'CDN_CLIENT_SECRET');
workerParamPathToEnvName.set('/atlas/collections/docsets', 'DOCSETS_COL_NAME');
workerParamPathToEnvName.set('/atlas/dbname', 'DB_NAME');
workerParamPathToEnvName.set('/atlas/collections/snooty', 'SNOOTY_DB_NAME');
workerParamPathToEnvName.set('/atlas/username', 'MONGO_ATLAS_USERNAME');
workerParamPathToEnvName.set('/atlas/host', 'MONGO_ATLAS_HOST');
// TODO: Figure out what to do about jobUpdatesQueueUrl
workerParamPathToEnvName.set('/github/bot/username', 'GITHUB_BOT_USERNAME');
workerParamPathToEnvName.set('/frontend/base_url', 'GATSBY_BASE_URL');
workerParamPathToEnvName.set('/flag/preview_build/enabled', 'PREVIEW_BUILD_ENABLED');
workerParamPathToEnvName.set('/flag/update_pages', 'FEATURE_FLAG_UPDATE_PAGES');

// change these
workerParamPathToEnvName.set('/flag/monorepo_path', 'FEATURE_FLAG_MONOREPO_PATH');
workerParamPathToEnvName.set('/atlas/collections/user/entitlements', 'USER_ENTITLEMENT_COL_NAME');
workerParamPathToEnvName.set('/npm/email', 'NPM_EMAIL');
workerParamPathToEnvName.set('/atlas/collections/repo', 'REPO_BRANCHES_COL_NAME');
workerParamPathToEnvName.set('/atlas/collections/docsets', 'DOCSETS_COL_NAME');
workerParamPathToEnvName.set('/flag/use_chatbot', 'GATSBY_SHOW_CHATBOT');
workerParamPathToEnvName.set('/flag/hide_locale', 'GATSBY_HIDE_UNIFIED_FOOTER_LOCALE');

async function getSecureStrings(
  ssmPrefix: string,
  params: readonly string[],
  paramToEnvMap: Map<string, string>,
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

      const envName = paramToEnvMap.get(paramName);

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

const snootyEnvs = ['staging', 'production', 'dotcomstg', 'dotcomprd', 'legacydotcomprd', 'legacydotcomstg'] as const;
const autoBuilderEnvs = ['stg', 'prd', 'dev', 'dotcomstg', 'dotcomprd', 'legacydotcomstg', 'legacydotcomprd'] as const;

type SnootyEnv = (typeof snootyEnvs)[number];
type AutoBuilderEnv = (typeof autoBuilderEnvs)[number];

const isAutoBuilderEnv = (str: string): str is AutoBuilderEnv => autoBuilderEnvs.includes(str as AutoBuilderEnv);

const autoBuilderToSnootyEnvMap: Record<AutoBuilderEnv, SnootyEnv> = {
  stg: 'staging',
  dev: 'staging',
  prd: 'production',
  dotcomprd: 'dotcomprd',
  dotcomstg: 'dotcomstg',
  legacydotcomstg: 'legacydotcomstg',
  legacydotcomprd: 'legacydotcomprd',
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
    env,
    workerParamStrings,
    workerParamPathToEnvName,
    'workerParamPathToEnvName'
  );

  return {
    ...envRecord,
    SNOOTY_ENV: envShortToFullName(env),
    SEARCH_INDEX_BUCKET: 'docs-search-indexes-test',
    CDN_INVALIDATOR_SERVICE_URL: getCdnInvalidatorUrl(env),
    MONGO_ATLAS_URL: `mongodb+srv://${envRecord.MONGO_ATLAS_USERNAME}:${envRecord.MONGO_ATLAS_PASSWORD}@${envRecord.MONGO_ATLAS_HOST}/admin?retryWrites=true`,
    JOB_UPDATES_QUEUE_URL: 'TODO: Add this',
  };
}
