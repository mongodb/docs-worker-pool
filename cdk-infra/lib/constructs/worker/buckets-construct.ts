import { Construct } from 'constructs';
import { docsBucketNames } from '../../utils/buckets';
import { BlockPublicAccess, Bucket, RoutingRule } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { getEnv } from '../../utils/env';

export class WorkerBucketsConstruct extends Construct {
  readonly buckets: Bucket[];
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const env = getEnv(this);

    const buckets: Bucket[] = [];

    docsBucketNames.forEach((bucketName) => {
      let websiteRoutingRules: RoutingRule[] | undefined;

      if (bucketName === 'docs-mongodb-org') {
        // docs-mongodb-org has specific routing roles that the rest of the buckets do not have
        websiteRoutingRules = []; // TODO: Populate this array with correct routing rules for root bucket
      }

      const bucket = new Bucket(this, bucketName, {
        removalPolicy: RemovalPolicy.DESTROY,
        websiteRoutingRules,
        bucketName: `${bucketName}-${env}`,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'docs-qa/404/index.html',
        blockPublicAccess: new BlockPublicAccess({
          blockPublicAcls: false,
          blockPublicPolicy: false,
          ignorePublicAcls: false,
          restrictPublicBuckets: false,
        }),
      });

      buckets.push(bucket);
    });

    this.buckets = buckets;
  }
}
