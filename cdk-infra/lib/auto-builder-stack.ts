import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderApiConstruct } from './constructs/api/api-construct';
import { AutoBuilderQueuesConstruct } from './constructs/queue/queues-construct';
import { AutoBuilderEnvConstruct } from './constructs/api/env-construct';

export class AutoBuilderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const queues = new AutoBuilderQueuesConstruct(this, 'queues');
    const { environment } = new AutoBuilderEnvConstruct(this, 'ssmVars', queues);

    new AutoBuilderApiConstruct(this, 'api', { ...queues, environment });
  }
}
