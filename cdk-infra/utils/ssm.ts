import { getEnv } from './env';
import {
  workerSecureStrings,
  webhookSecureStrings,
  getSecureStrings,
} from '../../src/enhanced/utils/get-sensitive-values';

export function getSsmPathPrefix(): string {
  const env = getEnv();

  return `/env/${env}/docs/worker_pool`;
}

type WorkerSecureString = (typeof workerSecureStrings)[number];

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

type WebhookSecureString = (typeof webhookSecureStrings)[number];

const webhookParamPathToEnvName = new Map<WebhookSecureString, string>();

webhookParamPathToEnvName.set('/github/bot/password', 'GITHUB_BOT_PASSWORD');
webhookParamPathToEnvName.set('/github/webhook/secret', 'GITHUB_SECRET');
webhookParamPathToEnvName.set('/github/webhook/deletionSecret', 'GITHUB_DELETION_SECRET');
webhookParamPathToEnvName.set('/atlas/password', 'MONGO_ATLAS_PASSWORD');
webhookParamPathToEnvName.set('/fastly/docs/dochub/token', 'FASTLY_DOCHUB_TOKEN');
webhookParamPathToEnvName.set('/fastly/docs/dochub/service_id', 'FASTLY_DOCHUB_SERVICE_ID');
webhookParamPathToEnvName.set('/fastly/dochub_map', 'FASTLY_DOCHUB_MAP');
webhookParamPathToEnvName.set('/cdn/client/id', 'CDN_CLIENT_ID');
webhookParamPathToEnvName.set('/cdn/client/secret', 'CDN_CLIENT_SECRET');
webhookParamPathToEnvName.set('/slack/auth/token', 'SLACK_TOKEN');
webhookParamPathToEnvName.set('/slack/webhook/secret', 'SLACK_SECRET');
webhookParamPathToEnvName.set('/snooty/webhook/secret', 'SNOOTY_SECRET');

export async function getWebhookSecureStrings(ssmPrefix: string): Promise<Record<string, string>> {
  return getSecureStrings(ssmPrefix, webhookSecureStrings, webhookParamPathToEnvName, 'webhookParamPathToEnvName');
}
