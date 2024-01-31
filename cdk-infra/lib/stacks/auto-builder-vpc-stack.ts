import { Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { AutoBuilderVpcConstruct } from '../constructs/auto-builder-vpc-construct';

export class AutoBuilderVpcStack extends Stack {
  readonly vpc: Vpc;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const { vpc } = new AutoBuilderVpcConstruct(this, 'enhanced-vpc');

    this.vpc = vpc;
  }
}
