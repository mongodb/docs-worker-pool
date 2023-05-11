import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import EnhancedWorkerConstruct from './constructs/ehnanced-worker-construct';

export default class EnhancedAutoBuilderStack extends Stack {
  constructor(scope: Construct, id: string, stackProps: StackProps) {
    super(scope, id, stackProps);

    const env = this.node.tryGetContext('env');

    if (!env) {
      throw new Error('ERROR! The context var env is not defined. Please pass env as cli argument e.g., -c env=val');
    }

    new EnhancedWorkerConstruct(this, id, { env });
  }
}
