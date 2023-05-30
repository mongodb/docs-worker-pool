import { Construct } from 'constructs';

export function getEnv(scope: Construct): string {
  const env = scope.node.tryGetContext('env');

  if (!env) return 'dev';

  return env;
}
