import { GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AssetImageProps, Cluster, ContainerImage, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { QueueProcessingFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { IRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path from 'path';

interface WorkerConstructProps {
  environment: Record<string, string>;
  queue: IQueue;
}
export class WorkerConstruct extends Construct {
  readonly ecsTaskRole: IRole;
  readonly taskDefinitionArn: string;
  constructor(scope: Construct, id: string, { environment, queue }: WorkerConstructProps) {
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

    const cluster = new Cluster(this, 'cluster', { vpc, enableFargateCapacityProviders: true });

    cluster.enableFargateCapacityProviders();

    const taskRole = new Role(this, 'fargateTaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    const taskDefinition = new FargateTaskDefinition(this, 'workerTaskDef', {
      cpu: 2048,
      memoryLimitMiB: 8192,
      taskRole,
    });

    const containerProps: AssetImageProps | undefined = isEnhanced
      ? {
          file: 'Dockerfile.enhanced',
        }
      : undefined;

    new QueueProcessingFargateService(this, 'fargateService', {
      cluster,
      taskDefinition,
      queue,
      environment,
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), containerProps),
      minScalingCapacity: 10,
      maxScalingCapacity: 20,
      maxHealthyPercent: 200,
      minHealthyPercent: 100,
    });

    this.taskDefinitionArn = taskDefinition.taskDefinitionArn;
    this.ecsTaskRole = taskRole;
  }
}
