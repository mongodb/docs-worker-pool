import { AutoBuilderEnv } from './env';

const hostUrlMap: Record<AutoBuilderEnv, string> = {
  dev: 'docs-dev.mongodb.com',
  stg: 'mongodbcom-cdn.website.staging.corp.mongodb.com',
  dotcomstg: 'mongodbcom-cdn.website.staging.corp.mongodb.com',
  prd: 'www.mongodb.com',
  dotcomprd: 'www.mongodb.com',
};

const urlPrefixMap: Record<AutoBuilderEnv, string> = {
  dev: 'docs',
  stg: 'docs-qa',
  dotcomstg: 'docs-qa',
  prd: 'docs',
  dotcomprd: 'docs',
};

export const getHostUrl = (env: AutoBuilderEnv): string => hostUrlMap[env];
export const getPrefixUrl = (env: AutoBuilderEnv): string => urlPrefixMap[env];
