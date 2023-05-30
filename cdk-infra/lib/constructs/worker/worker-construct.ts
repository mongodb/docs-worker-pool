import { GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { IRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import path from 'path';

export class WorkerConstruct extends Construct {
  readonly ecsTaskRole: IRole;
  readonly taskDefinitionArn: string;
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

    new Cluster(this, 'cluster', { vpc, enableFargateCapacityProviders: true });

    const taskRole = new Role(this, 'fargateTaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    const taskDef = new FargateTaskDefinition(this, 'workerTaskDef', {
      cpu: 2048,
      memoryLimitMiB: 8192,
      taskRole,
    });

    taskDef.addContainer('workerContainer', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), {
        file: 'Dockerfile.enhanced',
      }), // path to the directory that contains the docker file
    });

    this.taskDefinitionArn = taskDef.taskDefinitionArn;
    this.ecsTaskRole = taskRole;
  }
}
