import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, CpuArchitecture, FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import path from 'path';

interface CacheUpdaterWorkerConstructProps {
  vpc: IVpc;
}

export class CacheUpdaterWorkerConstruct extends Construct {
  clusterName: string;

  constructor(scope: Construct, id: string, { vpc }: CacheUpdaterWorkerConstructProps) {
    super(scope, id);

    const cluster = new Cluster(this, 'cacheUpdaterCluster', {
      vpc,
    });

    const taskDefinition = new FargateTaskDefinition(this, 'cacheUpdaterWorker', {
      cpu: 2048,
      memoryLimitMiB: 4096,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
      },
    });

    taskDefinition.addContainer('cacheUpdaterWorkerImage', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), {
        file: 'src/cache-updater/Dockerfile.cacheUpdater',
        exclude: ['tests/', 'node_modules/', 'cdk-infra/'], // adding this just in case it doesn't pick up our dockerignore
      }),
    });

    this.clusterName = cluster.clusterName;
  }
}
