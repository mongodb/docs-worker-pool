import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacheUpdaterApiConstruct } from '../constructs/cache-updater/cache-updater-api-construct';

export class CacheUpdaterStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new CacheUpdaterApiConstruct(this, 'cache-updater-resources');
  }
}
