import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderConstruct } from './constructs/auto-builder-construct';

export class AutoBuilderStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const env: string | undefined = this.node.tryGetContext('env');

    if (!env)
      throw new Error(
        'ERROR! The context variable env must be defined. Please define it by providing the flag -c env=<env>'
      );

    new AutoBuilderConstruct(this, `autobuilder-stack-${env}`, { env });
  }
}
