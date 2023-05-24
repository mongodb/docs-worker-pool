import { Construct } from 'constructs';
import { AutoBuilderQueuesConstruct } from './queue/queues-construct';
import { WorkerConstruct } from './worker/worker-construct';
import { WebhookEnvConstruct } from './api/webhook-env-construct';
import { WebhookApiConstruct } from './api/webhook-api-construct';

export class AutoBuilderConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const queues = new AutoBuilderQueuesConstruct(this, 'queues');
    const { environment } = new WebhookEnvConstruct(this, 'ssmVars', queues);

    const { taskDefinitionArn } = new WorkerConstruct(this, 'worker');
    new WebhookApiConstruct(this, 'api', {
      ...queues,
      environment: { ...environment, TASK_DEFINITION_FAMILY: taskDefinitionArn },
    });
  }
}
