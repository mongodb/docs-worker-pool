#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getSsmPathPrefix, getWebhookSecureStrings, getWorkerSecureStrings } from '../utils/ssm';
import { getFeatureName, initContextVars } from '../utils/env';
import { AutoBuilderQueueStack } from '../lib/stacks/auto-builder-queue-stack';
import { WorkerStack } from '../lib/stacks/worker-stack';
import { WebhookStack } from '../lib/stacks/webhook-stack';
import { AutoBuilderVpcStack } from '../lib/stacks/auto-builder-vpc-stack';
import { CacheUpdaterStack } from '../lib/stacks/cache-updater-stack';

async function main() {
  const app = new cdk.App();

  // calling this here so that we can call functions like getEnv and getSsmPathPrefix
  // without having to pass in current construct. More intuitive for developers to look at.
  // This will grab context variables that we pass in from the CLI and add it to a map.
  initContextVars(app);

  const ssmPrefix = getSsmPathPrefix();

  const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

  // Constructors can't be async, so since I am doing this workaround for the secure strings,
  // they need to be retrieved before we create the stack.
  const workerSecureStrings = await getWorkerSecureStrings(ssmPrefix);
  const webhookSecureStrings = await getWebhookSecureStrings(ssmPrefix);

  // Not using the stack name for the VPC because we will be using a single VPC for each stack.
  // This is because the VPC is a finite resource that quickly runs out of resources, specifically elastic IP
  // addresses. We have increased the quota before, but to do so every time we need a new VPC is cumbersome.
  // Putting resources within the same VPC should not be an issue as each queue, worker, and web hook API
  // are isolated resources that are not interacting with other stacks.
  // To separate between different environments, we can look into specific accounts for each environment:
  // https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-your-aws-environment.html
  const { vpc } = new AutoBuilderVpcStack(app, 'enhanced-vpc', { env });

  const stackName = `auto-builder-stack-${getFeatureName()}`;

  const queues = new AutoBuilderQueueStack(app, `${stackName}-queues`, { env });
  const { clusterName } = new WorkerStack(app, `${stackName}-worker`, { queues, workerSecureStrings, vpc, env });
  new WebhookStack(app, `${stackName}-webhooks`, {
    queues,
    clusterName,
    webhookSecureStrings,
    env,
  });

  new CacheUpdaterStack(app, `${stackName}-cache`, {
    vpc,
    env,
    githubSecret: workerSecureStrings.GITHUB_SECRET,
    githubBotPassword: workerSecureStrings.GITHUB_BOT_PASSWORD,
  });
}

main();
