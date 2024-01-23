import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacheUpdaterWorkerConstruct } from '../constructs/cache-updater/cache-updater-worker-construct';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { CacheUpdaterApiConstruct } from '../constructs/cache-updater/cache-updater-api-construct';

interface CacheUpdaterStackProps {
  vpc: IVpc;
}
export class CacheUpdaterStack extends Stack {
  constructor(scope: Construct, id: string, { vpc }: CacheUpdaterStackProps) {
    super(scope, id);

    const { clusterName, taskDefinition, containerName } = new CacheUpdaterWorkerConstruct(
      this,
      'cache-updater-resources',
      { vpc }
    );

    new CacheUpdaterApiConstruct(this, 'cache-updater-api', {
      clusterName,
      taskDefinition,
      containerName,
    });
  }
}
