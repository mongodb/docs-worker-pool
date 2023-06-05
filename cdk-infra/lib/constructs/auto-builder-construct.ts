import { Construct } from 'constructs';
import { AutoBuilderQueuesConstruct } from './queue/queues-construct';
import { WorkerConstruct } from './worker/worker-construct';
import { WebhookEnvConstruct } from './api/webhook-env-construct';
import { WebhookApiConstruct } from './api/webhook-api-construct';
import { WorkerBucketsConstruct } from './worker/buckets-construct';
import { WorkerEnvConstruct } from './worker/worker-env-construct';

interface AutoBuilderConstructProps {
  workerSecureStrings: Record<string, string>;
  webhookSecureStrings: Record<string, string>;
}
export class AutoBuilderConstruct extends Construct {
  constructor(scope: Construct, id: string, { workerSecureStrings, webhookSecureStrings }: AutoBuilderConstructProps) {
    super(scope, id);

    const queues = new AutoBuilderQueuesConstruct(this, 'queues');

    const { environment: webhookEnvironment } = new WebhookEnvConstruct(this, 'ssmVars', {
      ...queues,
      secureStrings: webhookSecureStrings,
    });
    const { environment: workerEnvironment } = new WorkerEnvConstruct(this, 'workerSsmVars', {
      ...queues,
      secureStrings: workerSecureStrings,
    });

    const { buckets } = new WorkerBucketsConstruct(this, 'workerBuckets');
    const { taskDefinitionArn, ecsTaskRole } = new WorkerConstruct(this, 'worker', {
      environment: workerEnvironment,
      queue: queues.jobsQueue,
    });
    new WebhookApiConstruct(this, 'api', {
      ...queues,
      environment: { ...webhookEnvironment, TASK_DEFINITION_FAMILY: taskDefinitionArn },
    });

    buckets.forEach((bucket) => {
      bucket.grantReadWrite(ecsTaskRole);
    });
  }
}
