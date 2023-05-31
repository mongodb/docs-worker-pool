import { Construct } from 'constructs';
import { getCurrentBranch } from './git';

const snootyEnvs = ['staging', 'production', 'dotcomstg', 'dotcomprd'] as const;
const autoBuilderEnvs = ['stg', 'prd', 'dev', 'dotcomstg', 'dotcomprd'] as const;

type SnootyEnv = typeof snootyEnvs[number];
export type AutoBuilderEnv = typeof autoBuilderEnvs[number];

const isAutoBuilderEnv = (str: string): str is AutoBuilderEnv => autoBuilderEnvs.includes(str as AutoBuilderEnv);

const autoBuilderToSnootyEnvMap: Record<AutoBuilderEnv, SnootyEnv> = {
  stg: 'staging',
  dev: 'staging',
  prd: 'production',
  dotcomprd: 'dotcomprd',
  dotcomstg: 'dotcomstg',
};

export function getEnv(scope: Construct): AutoBuilderEnv {
  const env: string | undefined = scope.node.tryGetContext('env');

  if (!env) return 'dev';
  if (!isAutoBuilderEnv(env)) throw new Error(`ERROR! ${env} is not a valid environment name`);

  return env;
}

export function envShortToFullName(env: string): SnootyEnv {
  if (!isAutoBuilderEnv(env)) throw new Error(`ERROR! ${env} is not a valid env`);

  return autoBuilderToSnootyEnvMap[env];
}
