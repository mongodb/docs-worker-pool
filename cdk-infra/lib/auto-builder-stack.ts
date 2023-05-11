import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderApiConstruct } from './constructs/auto-builder-api-construct';
import { AutoBuilderQueuesConstruct } from './constructs/auto-builder-queues-construct';
import { AutoBuilderEnvConstruct } from './constructs/auto-builder-env-construct';
import EnhancedWorkerConstruct from './constructs/ehnanced-worker-construct';

export class AutoBuilderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const env = this.node.tryGetContext('env');
    if (!env) {
      throw new Error('ERROR! The context var env is not defined. Please pass env as cli argument e.g., -c env=val');
    }
    const queues = new AutoBuilderQueuesConstruct(this, 'queues');
    const { environment } = new AutoBuilderEnvConstruct(this, 'ssmVars', queues);

    new AutoBuilderApiConstruct(this, 'api', { ...queues, environment });

    new EnhancedWorkerConstruct(this, 'test-worker', { queue: queues.jobsQueue, env });
  }
}
