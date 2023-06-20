import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { getEnv } from './env';

export function getSsmPathPrefix(): string {
  const env = getEnv();

  return `/env/${env}/docs/worker_pool`;
}

/**
 * Returns the secure strings from SSM using the SSM client.
 * @param ssmPrefix the path prefix that should contain the environment for the SSM strings (e.g. /env/dotcomstg/worker_pool/)
 * @returns The map of environment variables.
 */
async function getSecureStrings(
  ssmPrefix: string,
  secureStrings: readonly string[],
  paramToEnvMap: Map<string, string>,
  resourceName: string
) {
  const ssmClient = new SSMClient({ region: process.env.CDK_DEFAULT_REGION });

  const secureStringsMap: Record<string, string> = {};

  await Promise.all(
    secureStrings.map(async (paramName: string) => {
      const getParamCommand = new GetParameterCommand({
        Name: `${ssmPrefix}${paramName}`,
        WithDecryption: true,
      });

      const ssmResponse = await ssmClient.send(getParamCommand);
      const secureString = ssmResponse.Parameter?.Value;

      if (!secureString) {
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

      secureStringsMap[envName] = secureString;
    })
  );

  return secureStringsMap;
}

const workerSecureStrings = [
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
] as const;

type WorkerSecureString = typeof workerSecureStrings[number];

const workerParamPathToEnvName = new Map<WorkerSecureString, string>();

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

export async function getWorkerSecureStrings(ssmPrefix: string): Promise<Record<string, string>> {
  return getSecureStrings(ssmPrefix, workerSecureStrings, workerParamPathToEnvName, 'workerParamPathToEnvName');
}

const webhookSecureStrings = [
  '/github/webhook/secret',
  '/atlas/password',
  '/fastly/docs/dochub/token',
  '/fastly/docs/dochub/service_id',
  '/fastly/dochub_map',
  '/cdn/client/id',
  '/cdn/client/secret',
  '/slack/webhook/secret',
  '/slack/auth/token',
] as const;

type WebhookSecureString = typeof webhookSecureStrings[number];

const webhookParamPathToEnvName = new Map<WebhookSecureString, string>();

webhookParamPathToEnvName.set('/github/webhook/secret', 'GITHUB_SECRET');
webhookParamPathToEnvName.set('/atlas/password', 'MONGO_ATLAS_PASSWORD');
webhookParamPathToEnvName.set('/fastly/docs/dochub/token', 'FASTLY_DOCHUB_TOKEN');
webhookParamPathToEnvName.set('/fastly/docs/dochub/service_id', 'FASTLY_DOCHUB_SERVICE_ID');
webhookParamPathToEnvName.set('/fastly/dochub_map', 'FASTLY_DOCHUB_MAP');
webhookParamPathToEnvName.set('/cdn/client/id', 'CDN_CLIENT_ID');
webhookParamPathToEnvName.set('/cdn/client/secret', 'CDN_CLIENT_SECRET');
webhookParamPathToEnvName.set('/slack/auth/token', 'SLACK_TOKEN');
webhookParamPathToEnvName.set('/slack/webhook/secret', 'SLACK_SECRET');

export async function getWebhookSecureStrings(ssmPrefix: string): Promise<Record<string, string>> {
  return getSecureStrings(ssmPrefix, webhookSecureStrings, webhookParamPathToEnvName, 'webhookParamPathToEnvName');
}
