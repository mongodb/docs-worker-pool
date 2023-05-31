import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export function getSsmPathPrefix(env: string): string {
  return `/env/${env}/docs/worker_pool`;
}

const workerSecureStrings = [
  '/atlas/password',
  '/fastly/docs/dochub/token',
  '/fastly/docs/dochub/service_id',
  '/fastly/dochub_map',
  '/fastly/docs/main/token',
  '/fastly/docs/cloudmanager/service_id',
];

const paramPathToEnvName = new Map<string, string>();

export async function getWorkerSecureStrings(ssmPrefix: string): Promise<Record<string, string>> {
  const ssmClient = new SSMClient({ region: process.env.CDK_DEFAULT_REGION });

  const secureStrings: Record<string, string> = {};

  const keyValues = await Promise.all(
    workerSecureStrings.map(async (paramName) => {
      const getParamCommand = new GetParameterCommand({
        Name: `${ssmPrefix}${paramName}`,
        WithDecryption: true,
      });

      const res = await ssmClient.send(getParamCommand);
      res.Parameter?.Value;
    })
  );

  return secureStrings;
}
