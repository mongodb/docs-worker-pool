import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacheUpdaterWorkerConstruct } from '../constructs/cache-updater/cache-updater-worker-construct';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { CacheUpdaterApiConstruct } from '../constructs/cache-updater/cache-updater-api-construct';

interface CacheUpdaterStackProps extends StackProps {
  vpc: Vpc;
}
export class CacheUpdaterStack extends Stack {
  constructor(scope: Construct, id: string, { vpc, ...props }: CacheUpdaterStackProps) {
    super(scope, id, props);

    const { clusterName, taskDefinition, containerName } = new CacheUpdaterWorkerConstruct(
      this,
      'cache-updater-resources',
      { vpc }
    );

    new CacheUpdaterApiConstruct(this, 'cache-updater-api', {
      clusterName,
      taskDefinition,
      containerName,
      vpc,
    });
  }
}
