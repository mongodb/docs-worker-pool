import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { AutoBuilderQueues } from './auto-builder-queue-stack';
import { WebhookApiConstruct } from '../constructs/api/webhook-api-construct';
import { WebhookEnvConstruct } from '../constructs/api/webhook-env-construct';

interface WebhookStackProps extends StackProps {
  webhookSecureStrings: Record<string, string>;
  queues: AutoBuilderQueues;
  clusterName: string;
  vpc: Vpc;
  taskDefinition: TaskDefinition;
}

//TODO: use taskDefition and vpc somewhere here
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
