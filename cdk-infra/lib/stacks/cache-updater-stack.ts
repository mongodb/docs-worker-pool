import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CacheUpdaterWorkerConstruct } from '../constructs/cache-updater/cache-updater-worker-construct';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

interface CacheUpdaterStackProps {
  vpc: IVpc;
}
export class CacheUpdaterStack extends Stack {
  constructor(scope: Construct, id: string, { vpc }: CacheUpdaterStackProps) {
    super(scope, id);

    new CacheUpdaterWorkerConstruct(this, 'cache-updater-resources', { vpc });
  }
}
