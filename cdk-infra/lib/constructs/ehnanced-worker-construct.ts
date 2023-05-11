import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { QueueProcessingFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path = require('path');

interface WarmPoolConstructProps {
  env: string;
  queue: IQueue;
}
export default class EnhancedWorkerConstruct extends Construct {
  constructor(scope: Construct, id: string, { env, queue }: WarmPoolConstructProps) {
    super(scope, id);
    const vpc = new Vpc(this, 'vpc');

    const cluster = new Cluster(this, 'autobuilder-cluster', { vpc, containerInsights: true });

    // const ecrRepository = Repository.fromRepositoryName(this, 'ecrImage', `docs-worker-pool-${env}`);

    new QueueProcessingFargateService(this, 'autobuilder-service', {
      queue,
      cluster,
      cpu: 2,
      memoryLimitMiB: 1024,
      command: ['node', 'app.js'],
      image: ContainerImage.fromDockerImageAsset(
        new DockerImageAsset(this, 'testApp', { directory: path.join(__dirname, '../../docker-test') })
      ),
      capacityProviderStrategies: [{ capacityProvider: 'FARGATE', base: 4 }],
    });
  }
}
