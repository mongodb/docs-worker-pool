import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderQueues } from './auto-builder-queue-stack';
import { WebhookApiConstruct } from '../constructs/api/webhook-api-construct';
import { WebhookEnvConstruct } from '../constructs/api/webhook-env-construct';

interface WebhookStackProps extends StackProps {
  webhookSecureStrings: Record<string, string>;
  queues: AutoBuilderQueues;
  clusterName: string;
}
export class WebhookStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    { queues, webhookSecureStrings, clusterName, ...props }: WebhookStackProps
  ) {
    super(scope, id, props);

    const { environment: webhookEnvironment } = new WebhookEnvConstruct(this, 'ssmVars', {
      ...queues,
      secureStrings: webhookSecureStrings,
    });

    new WebhookApiConstruct(this, 'api', {
      ...queues,
      environment: { ...webhookEnvironment, TASK_DEFINITION_FAMILY: clusterName },
    });
  }
}
