#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { getSsmPathPrefix, getWebhookSecureStrings, getWorkerSecureStrings } from '../utils/ssm';
import { getFeatureName, initContextVars } from '../utils/env';
import { AutoBuilderQueueStack } from '../lib/stacks/auto-builder-queue-stack';
import { WorkerStack } from '../lib/stacks/worker-stack';
import { WebhookStack } from '../lib/stacks/webhook-stack';

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

  const stackName = `auto-builder-stack-${getFeatureName()}`;

  const queues = new AutoBuilderQueueStack(app, `${stackName}-queues`, { env });
  const { clusterName } = new WorkerStack(app, `${stackName}-worker`, { queues, workerSecureStrings, env });
  new WebhookStack(app, `${stackName}-webhooks`, {
    queues,
    clusterName,
    webhookSecureStrings,
    env,
  });
}

main();
