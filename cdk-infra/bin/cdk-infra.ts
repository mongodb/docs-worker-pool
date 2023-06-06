#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AutoBuilderStack } from '../lib/auto-builder-stack';
import { getSsmPathPrefix, getWebhookSecureStrings, getWorkerSecureStrings } from '../utils/ssm';
import { getEnv } from '../utils/env';
import { getCurrentBranch } from '../utils/git';

async function main() {
  const app = new cdk.App();
  const env = getEnv(app);

  const ssmPrefix = getSsmPathPrefix(env);

  const workerSecureStrings = await getWorkerSecureStrings(ssmPrefix);
  const webhookSecureStrings = await getWebhookSecureStrings(ssmPrefix);

  let stackName = 'auto-builder-stack';

  // If we want to create a specific feature, we will use this name.
  // NOTE: This value will take precedence over the feature branch name so that
  // we can deploy and update the same stack for a specific feature between branches.
  const customFeatureName = app.node.tryGetContext('featureName');

  // If this is a feature branch i.e., it's not master, use this name.
  const isFeatureBranch = app.node.tryGetContext('isFeature');

  if (customFeatureName) {
    stackName += `-${customFeatureName}`;
  } else if (isFeatureBranch) {
    stackName += `-${getCurrentBranch()}`;
  }

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
