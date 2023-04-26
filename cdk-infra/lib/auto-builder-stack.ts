import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderApiConstruct } from './constructs/auto-builder-api-construct';
import { AutoBuilderQueuesConstruct } from './constructs/auto-builder-queues-construct';

export class AutoBuilderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queues = new AutoBuilderQueuesConstruct(this, 'queues');

    new AutoBuilderApiConstruct(this, 'api', queues);
  }
}
