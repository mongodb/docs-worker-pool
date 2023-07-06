import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { WebhookApiConstruct } from '../constructs/api/webhook-api-construct';
import { WebhookEnvConstruct } from '../constructs/api/webhook-env-construct';
import { AutoBuilderQueuesConstruct } from '../constructs/queue/queues-construct';
import { WorkerBucketsConstruct } from '../constructs/worker/buckets-construct';
import { WorkerConstruct } from '../constructs/worker/worker-construct';
import { WorkerEnvConstruct } from '../constructs/worker/worker-env-construct';

interface AutoBuilderStackProps extends StackProps {
  workerSecureStrings: Record<string, string>;
  webhookSecureStrings: Record<string, string>;
}
export class AutoBuilderStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    { workerSecureStrings, webhookSecureStrings, ...props }: AutoBuilderStackProps
  ) {
    super(scope, id, props);

    const queues = new AutoBuilderQueuesConstruct(this, 'queues');

    const { environment: webhookEnvironment } = new WebhookEnvConstruct(this, 'ssmVars', {
      ...queues,
      secureStrings: webhookSecureStrings,
    });
    const { environment: workerEnvironment } = new WorkerEnvConstruct(this, 'workerSsmVars', {
      ...queues,
      secureStrings: workerSecureStrings,
    });

    const { clusterName, ecsTaskRole } = new WorkerConstruct(this, 'worker', {
      dockerEnvironment: workerEnvironment,
      ...queues,
    });

    const { buckets } = new WorkerBucketsConstruct(this, 'workerBuckets');

    new WebhookApiConstruct(this, 'api', {
      ...queues,
      environment: { ...webhookEnvironment, TASK_DEFINITION_FAMILY: clusterName },
    });

    buckets.forEach((bucket) => {
      bucket.grantReadWrite(ecsTaskRole);
    });
  }
}
