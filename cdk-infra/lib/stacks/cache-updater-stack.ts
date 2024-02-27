import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacheUpdaterWorkerConstruct } from '../constructs/cache-updater/cache-updater-worker-construct';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { CacheUpdaterApiConstruct } from '../constructs/cache-updater/cache-updater-api-construct';

interface CacheUpdaterStackProps extends StackProps {
  vpc: Vpc;
  githubSecret: string;
  githubBotPassword: string;
}
export class CacheUpdaterStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    { vpc, githubSecret, githubBotPassword, ...props }: CacheUpdaterStackProps
  ) {
    super(scope, id, props);

    const { clusterName, taskDefinition, containerName } = new CacheUpdaterWorkerConstruct(
      this,
      'cache-updater-resources',
      { vpc, githubBotPassword }
    );

    new CacheUpdaterApiConstruct(this, 'cache-updater-api', {
      clusterName,
      taskDefinition,
      containerName,
      vpc,
      githubSecret,
    });
  }
}
