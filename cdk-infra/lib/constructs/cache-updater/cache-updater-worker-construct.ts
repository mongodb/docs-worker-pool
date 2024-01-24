import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster, ContainerImage, FargateTaskDefinition, LogDrivers, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import path from 'path';
import { getSnootyParserVersion } from '../../../utils/env';

const SNOOTY_CACHE_BUCKET_NAME = 'snooty-parse-cache';

interface CacheUpdaterWorkerConstructProps {
  vpc: IVpc;
}

export class CacheUpdaterWorkerConstruct extends Construct {
  readonly clusterName: string;
  readonly taskDefinition: TaskDefinition;
  readonly containerName: string;

  constructor(scope: Construct, id: string, { vpc }: CacheUpdaterWorkerConstructProps) {
    super(scope, id);

    const cluster = new Cluster(this, 'cacheUpdaterCluster', {
      vpc,
    });

    const taskRole = new Role(this, 'cacheUpdateWorkerTaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    const snootyParseCacheBucket = Bucket.fromBucketName(this, SNOOTY_CACHE_BUCKET_NAME, SNOOTY_CACHE_BUCKET_NAME);

    snootyParseCacheBucket.grantWrite(taskRole);

    const taskDefinition = new FargateTaskDefinition(this, 'cacheUpdaterWorker', {
      cpu: 2048,
      memoryLimitMiB: 4096,
      taskRole,
    });

    const containerName = 'cacheUpdaterWorkerImage';
    const taskDefLogGroup = new LogGroup(this, 'cacheUpdaterWorkerLogGroup');

    const snootyParserVersion = getSnootyParserVersion();

    taskDefinition.addContainer('cacheUpdaterWorkerImage', {
      image: ContainerImage.fromAsset(path.join(__dirname, '../../../../'), {
        file: 'src/cache-updater/Dockerfile.cacheUpdater',
        buildArgs: { SNOOTY_PARSER_VERSION: snootyParserVersion },
        exclude: ['tests/', 'node_modules/', 'cdk-infra/'], // adding this just in case it doesn't pick up our dockerignore
      }),
      environment: {
        SNOOTY_CACHE_BUCKET_NAME,
      },
      logging: LogDrivers.awsLogs({
        streamPrefix: 'cacheupdater',
        logGroup: taskDefLogGroup,
      }),
    });

    this.clusterName = cluster.clusterName;
    this.taskDefinition = taskDefinition;
    this.containerName = containerName;
  }
}
