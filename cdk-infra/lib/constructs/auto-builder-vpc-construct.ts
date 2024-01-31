import { Vpc, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class AutoBuilderVpcConstruct extends Construct {
  readonly vpc: Vpc;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new Vpc(this, 'vpc', {
      gatewayEndpoints: {
        S3: { service: GatewayVpcEndpointAwsService.S3 },
      },
    });

    vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    vpc.addInterfaceEndpoint('EcrApiEndpoint', {
      service: InterfaceVpcEndpointAwsService.ECR,
    });

    this.vpc = vpc;
  }
}
