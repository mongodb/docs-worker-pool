import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export function getSsmPathPrefix(env: string): string {
  return `/env/${env}/docs/worker_pool`;
}

const workerSecureStrings = [
  '/atlas/password',
  '/fastly/docs/dochub/token',
  '/npm/auth',
  '/fastly/docs/dochub/service_id',
  '/fastly/dochub_map',
  '/fastly/docs/main/token',
  '/fastly/docs/cloudmanager/service_id',
] as const;

type WorkerSecureString = typeof workerSecureStrings[number];

const paramPathToEnvName = new Map<WorkerSecureString, string>();

paramPathToEnvName.set('/atlas/password', 'MONGO_ATLAS_PASSWORD');
paramPathToEnvName.set('/fastly/docs/dochub/token', 'FASTLY_DOCHUB_TOKEN');
paramPathToEnvName.set('/npm/auth', 'NPM_BASE_64_AUTH');

export async function getWorkerSecureStrings(ssmPrefix: string): Promise<Record<string, string>> {
  const ssmClient = new SSMClient({ region: process.env.CDK_DEFAULT_REGION });

  const secureStrings: Record<string, string> = {};

  await Promise.all(
    workerSecureStrings.map(async (paramName: WorkerSecureString) => {
      const getParamCommand = new GetParameterCommand({
        Name: `${ssmPrefix}${paramName}`,
        WithDecryption: true,
      });

      const res = await ssmClient.send(getParamCommand);
      const secureString = res.Parameter?.Value;

      if (!secureString) {
        console.error(`ERROR! Could not retrieve string for the following param: ${paramName}`);
        return;
      }

      const envName = paramPathToEnvName.get(paramName);

      if (!envName) {
        console.error(
          `ERROR! The param '${paramName}' does not having a mapping to an environment variable name. Please define this in the paramPathToEnvName map.`
        );
        return;
      }

      secureStrings[envName] = secureString;
    })
  );

  return secureStrings;
}
