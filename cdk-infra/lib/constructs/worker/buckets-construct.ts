import { Construct } from 'constructs';
import { DocsBucketMap, docsBucketNames } from '../../utils/buckets';
import { BlockPublicAccess, Bucket, RoutingRule } from 'aws-cdk-lib/aws-s3';

interface WorkerBucketsProps {
  env: string;
}

export class WorkerBucketsConstruct extends Construct {
  constructor(scope: Construct, id: string, { env }: WorkerBucketsProps) {
    super(scope, id);

    const bucketMap: DocsBucketMap = {};

    docsBucketNames.forEach((bucketName) => {
      let websiteRoutingRules: RoutingRule[] | undefined;

      if (bucketName === 'docs-mongodb-org') {
        websiteRoutingRules = [];
      }

      const bucket = new Bucket(this, bucketName, {
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

      // apply specific rules DocsBucket

      bucketMap[bucketName] = bucket;
    });
  }
}
