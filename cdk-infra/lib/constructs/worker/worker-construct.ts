import { GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AssetImageProps, Cluster, ContainerImage, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { IRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import path from 'path';

interface WorkerConstructProps {
  environment: Record<string, string>;
}
export class WorkerConstruct extends Construct {
  readonly ecsTaskRole: IRole;
  readonly taskDefinitionArn: string;
  constructor(scope: Construct, id: string, { environment }: WorkerConstructProps) {
    super(scope, id);

    const isEnhanced = !!this.node.tryGetContext('enhanced');

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

    const containerProps: AssetImageProps | undefined = isEnhanced
      ? {
          file: 'Dockerfile.enhanced',
          buildSecrets: {},
        }
      : undefined;

    taskDef.addContainer('workerContainer', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), containerProps), // path to the directory that contains the docker file
      environment,
    });

    this.taskDefinitionArn = taskDef.taskDefinitionArn;
    this.ecsTaskRole = taskRole;
  }
}
