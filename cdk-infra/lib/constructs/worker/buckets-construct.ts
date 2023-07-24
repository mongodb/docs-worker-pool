import { Construct } from 'constructs';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { createCustomBucket, docsBucketNames } from '../../../utils/buckets';
import { getEnv, getFeatureName, getUseCustomBuckets } from '../../../utils/env';

export class WorkerBucketsConstruct extends Construct {
  readonly buckets: IBucket[];
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const env = getEnv();

    const buckets: IBucket[] = docsBucketNames.map((bucketName) => {
      const featureName = getFeatureName();
      const useCustomBuckets = getUseCustomBuckets();

      // If we want to use buckets that don't currently exist, we can call this method to create
      // them for individual testing purposes
      if (useCustomBuckets) return createCustomBucket({ scope: this, featureName, env, bucketName });

      const bucketEnv = env === 'prd' ? 'prd-staging' : env;
      const bucketConstructId = `${featureName}-${bucketName}-${bucketEnv}`.toLowerCase();

      const bucket = Bucket.fromBucketName(this, bucketConstructId, `${bucketName}-${bucketEnv}`);

      return bucket;
    });

    this.buckets = buckets;
  }
}
