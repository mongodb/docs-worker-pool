import { Construct } from 'constructs';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { docsBucketNames } from '../../../utils/buckets';
import { getEnv, getFeatureName } from '../../../utils/env';

export class WorkerBucketsConstruct extends Construct {
  readonly buckets: IBucket[];
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const env = getEnv();

    const buckets: IBucket[] = docsBucketNames.map((bucketName) => {
      const featureName = getFeatureName();

      const stackBucketName = `${featureName}-${bucketName}-${env}`.toLowerCase();
      const bucket = Bucket.fromBucketName(this, stackBucketName, `${bucketName}-${env}`);

      return bucket;
    });

    this.buckets = buckets;
  }
}
