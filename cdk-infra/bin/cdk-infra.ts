#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AutoBuilderStack } from '../lib/auto-builder-stack';
import { getSsmPathPrefix, getWebhookSecureStrings, getWorkerSecureStrings } from '../utils/ssm';
import { getFeatureName, initContextVars } from '../utils/env';

async function main() {
  const app = new cdk.App();

  // calling this here so that we can call functions like getEnv and getSsmPathPrefix
  // without having to pass in current construct. More intuitive for developers to look at.
  // This will grab context variables that we pass in from the CLI and add it to a map.
  initContextVars(app);

  const ssmPrefix = getSsmPathPrefix();

  // Constructors can't be async, so since I am doing this workaround for the secure strings,
  // they need to be retrieved before we create the stack.
  const workerSecureStrings = await getWorkerSecureStrings(ssmPrefix);
  const webhookSecureStrings = await getWebhookSecureStrings(ssmPrefix);

  const stackName = `auto-builder-stack-${getFeatureName()}`;

  new AutoBuilderStack(app, stackName, {
    /* If you don't specify 'env', this stack will be environment-agnostic.
     * Account/Region-dependent features and context lookups will not work,
     * but a single synthesized template can be deployed anywhere. */
    /* Uncomment the next line to specialize this stack for the AWS Account
     * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    /* Uncomment the next line if you know exactly what Account and Region you
     * want to deploy the stack to. */
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    workerSecureStrings,
    webhookSecureStrings,
    tags: {
      stackName,
    },
    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  });
}

main();
