import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

// This array contains the Parameter Store paths of the secure strings
// we want to add to the worker environment. These are mapped
// to their environment variable name in the workerParamPathToEnvName map.
export const workerSecureStrings = [
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

// This array contains the Parameter Store paths of the secure strings
// we want to add to the webhooks environment. These are mapped
// to their environment variable name in the webhookParamPathToEnvName map.
export const webhookSecureStrings = [
  '/github/bot/password',
  '/github/webhook/secret',
  '/github/webhook/deletionSecret',
  '/atlas/password',
  '/fastly/docs/dochub/token',
  '/fastly/docs/dochub/service_id',
  '/fastly/dochub_map',
  '/cdn/client/id',
  '/cdn/client/secret',
  '/slack/webhook/secret',
  '/slack/auth/token',
  '/snooty/webhook/secret',
] as const;

/**
 * Used to capture the sensitive values and store them
 * as sensitive keys, to later be filtered in the Logger
 */
export const sensitiveKeys: string[] = [];

/**
 * Returns the secure strings from SSM using the SSM client.
 * @param ssmPrefix the path prefix that should contain the environment for the SSM strings (e.g. /env/dotcomstg/worker_pool/)
 * @returns The map of environment variables.
 */
export async function getSecureStrings(
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

      /**
       * Hijacks the getSecureString to populate the
       * sensitive key array, used in the filterSensitiveValue
       */
      sensitiveKeys.push(secureString);

      const envName = paramToEnvMap.get(paramName);

      if (!envName) {
        console.error(
          `ERROR! The param '${paramName}' does not have a mapping to an environment variable name. Please define this in the ${resourceName} map.`
        );
        return;
      }

      secureStringsMap[envName] = secureString;
    })
  );

  return secureStringsMap;
}
