import { Construct } from 'constructs';
import { AutoBuilderQueuesConstruct } from './queue/queues-construct';
import { WorkerConstruct } from './worker/worker-construct';
import { WebhookEnvConstruct } from './api/webhook-env-construct';
import { WebhookApiConstruct } from './api/webhook-api-construct';
import { WorkerBucketsConstruct } from './worker/buckets-construct';

interface AutoBuilderConstructProps {
  env: string;
}
export class AutoBuilderConstruct extends Construct {
  constructor(scope: Construct, id: string, { env }: AutoBuilderConstructProps) {
    super(scope, id);

    const queues = new AutoBuilderQueuesConstruct(this, 'queues');
    const { environment } = new WebhookEnvConstruct(this, 'ssmVars', queues);

    const { taskDefinitionArn, ecsTaskRole } = new WorkerConstruct(this, 'worker');

    const { buckets } = new WorkerBucketsConstruct(this, 'workerBuckets', { env });

    buckets.forEach((bucket) => {
      bucket.grantReadWrite(ecsTaskRole);
    });

    new WebhookApiConstruct(this, 'api', {
      ...queues,
      environment: { ...environment, TASK_DEFINITION_FAMILY: taskDefinitionArn },
    });
  }
}
