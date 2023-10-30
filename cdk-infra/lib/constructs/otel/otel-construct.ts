import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

interface Props {
  vpc: IVpc;
}

export class OtelCollectorConstruct extends Construct {
  constructor(scope: Construct, id: string, { vpc }: Props) {
    super(scope, id);

    const cluster = new Cluster(this, 'otel-cluster', {
      vpc,
      enableFargateCapacityProviders: true,
      containerInsights: true,
    });
  }
}
