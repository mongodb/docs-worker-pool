import { AutoBuilderEnv } from './env';

export function getCdnInvalidatorUrl(env: AutoBuilderEnv): string {
  return `https://cdnvalidator.${
    env === 'dotcomprd' || env === 'prd' ? 'prod' : 'staging'
  }.staging.corp.mongodb.com/api/v1beta1/distributions/${env}/invalidations`;
}
