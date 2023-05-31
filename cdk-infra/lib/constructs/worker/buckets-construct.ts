import { Construct } from 'constructs';
import { docsBucketNames } from '../../utils/buckets';
import { BlockPublicAccess, Bucket, RedirectProtocol, RoutingRule } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { getEnv } from '../../utils/env';
import { getHostUrl, getPrefixUrl } from '../../utils/url';

export class WorkerBucketsConstruct extends Construct {
  readonly buckets: Bucket[];
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const env = getEnv(this);

    const buckets: Bucket[] = [];

    docsBucketNames.forEach((bucketName) => {
      let websiteRoutingRules: RoutingRule[] | undefined;

      if (bucketName === 'docs-mongodb-org') {
        const hostName = getHostUrl(env);
        const prefixUrl = getPrefixUrl(env);
        // docs-mongodb-org has specific routing roles that the rest of the buckets do not have
        websiteRoutingRules = [
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/master`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/upcoming`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.3.0`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.3`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.2.1`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.2`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.2.0`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.2`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.7`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.1`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.6`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.1`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.5`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.1`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.3`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.1`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.2`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.1`,
            },
          },
          {
            condition: {
              keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.0`,
            },
            protocol: RedirectProtocol.HTTPS,
            hostName,
            replaceKey: {
              prefixWithKey: `${prefixUrl}/atlas/cli/v1.1`,
            },
          },
        ];
      }

      const featureName = this.node.tryGetContext('featureName');

      const stackBucketName = `${featureName}-${bucketName}-${env}`.toLowerCase();

      const bucket = new Bucket(this, stackBucketName, {
        removalPolicy: RemovalPolicy.DESTROY,
        websiteRoutingRules,
        bucketName: stackBucketName,
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
