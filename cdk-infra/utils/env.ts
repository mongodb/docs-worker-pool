import { Construct } from 'constructs';
import { getCurrentBranch } from './git';

const snootyEnvs = ['staging', 'production', 'dotcomstg', 'dotcomprd'] as const;
const autoBuilderEnvs = ['stg', 'prd', 'dev', 'dotcomstg', 'dotcomprd'] as const;
const autoBuilderContextVariables = [
  'enhanced',
  'isFeatureBranch',
  'customFeatureName',
  'env',
  'useCustomBuckets',
  'snootyParserVersion',
] as const;

export type SnootyEnv = (typeof snootyEnvs)[number];
export type AutoBuilderEnv = (typeof autoBuilderEnvs)[number];
export type AutoBuilderContextVariable = (typeof autoBuilderContextVariables)[number];

const isAutoBuilderEnv = (str: string): str is AutoBuilderEnv => autoBuilderEnvs.includes(str as AutoBuilderEnv);

const autoBuilderToSnootyEnvMap: Record<AutoBuilderEnv, SnootyEnv> = {
  stg: 'staging',
  dev: 'staging',
  prd: 'production',
  dotcomprd: 'dotcomprd',
  dotcomstg: 'dotcomstg',
};

export function envShortToFullName(env: string): SnootyEnv {
  if (!isAutoBuilderEnv(env)) throw new Error(`ERROR! ${env} is not a valid env`);

  return autoBuilderToSnootyEnvMap[env];
}

const contextVarsMap = new Map<AutoBuilderContextVariable, string | undefined>();
let areContextVarsInitialized = false;

export function initContextVars(scope: Construct): void {
  autoBuilderContextVariables.forEach((contextVar) => {
    contextVarsMap.set(contextVar, scope.node.tryGetContext(contextVar));
  });

  areContextVarsInitialized = true;
}

function checkContextInit(): void {
  if (!areContextVarsInitialized) throw new Error('ERROR, initContextVars has not been called.');
}

export function getIsEnhanced(): boolean {
  checkContextInit();
  const isEnhanced = contextVarsMap.get('enhanced');

  return isEnhanced === 'true';
}

export function getUseCustomBuckets(): boolean {
  checkContextInit();
  const useCustomBuckets = contextVarsMap.get('useCustomBuckets');

  return useCustomBuckets === 'true';
}

export function getEnv(): AutoBuilderEnv {
  checkContextInit();

  const env = contextVarsMap.get('env');

  if (!env) return 'dev';
  if (!isAutoBuilderEnv(env)) throw new Error(`ERROR! ${env} is not a valid environment name`);

  return env;
}

export function isEnhanced(): boolean {
  return !!contextVarsMap.get('enhanced');
}

/**
 * This value is used by the rebuild-parse-cache custom GitHub Action
 */
export function getSnootyParserVersion(): string {
  checkContextInit();
  const snootyParserVersion = contextVarsMap.get('snootyParserVersion');

  if (!snootyParserVersion) {
    console.warn('Error! The context variable snootyParserVersion is not defined.');
    return '';
  }

  return snootyParserVersion;
}

export function getIsFeatureBranch() {
  checkContextInit();
  const isFeatureBranch = contextVarsMap.get('isFeatureBranch');

  if (!isFeatureBranch) {
    console.warn('Error! The context variable isFeatureBranch is not defined.');
    return '';
  }

  return isFeatureBranch;
}

export function getFeatureName(): string {
  checkContextInit();

  // If we want to create a specific feature, we will use this name.
  // NOTE: This value will take precedence over the feature branch name so that
  // we can deploy and update the same stack for a specific feature between branches.
  const customFeatureName = contextVarsMap.get('customFeatureName');

  // If this is a feature branch i.e., it's not master, use this name.
  const isFeatureBranch = contextVarsMap.get('isFeatureBranch');

  if (customFeatureName) return customFeatureName;
  if (isFeatureBranch) return getCurrentBranch();

  throw new Error(
    `Error! Neither a custom feature name was specified, nor is this branch a feature branch. Please define a feature name, or deploy from a branch.`
  );
}
