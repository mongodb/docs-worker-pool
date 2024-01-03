import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface CacheUpdaterWorkerConstructProps {
  vpc: IVpc;
}

export class CacheUpdaterWorkerConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}
