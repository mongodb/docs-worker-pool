import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class WorkerConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new Bucket(this, 'test');
  }
}
