import { RoutingRule, RedirectProtocol, BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { getHostUrl, getPrefixUrl } from './url';
import { AutoBuilderEnv } from './env';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export const docsBucketNames = [
  'docs-mongodb-org',
  'docs-atlas',
  'docs-atlas-osb',
  'docs-govcloud',
  'docs-cloudmanager',
  'docs-opsmanager',
  'docs-csharp',
  'docs-go',
  'docs-java',
  'docs-node',
  'docs-languages',
] as const;

interface CustomBucketProps {
  scope: Construct;
  featureName: string;
  env: AutoBuilderEnv;
  bucketName: string;
}
export function createCustomBucket({ scope, featureName, env, bucketName }: CustomBucketProps): Bucket {
  const stackBucketName = `${featureName}-${bucketName}-${env}`.toLowerCase();
  const websiteRoutingRules = bucketName === 'docs-mongodb-org' ? getMongoDocsBucketRoutingRules(env) : undefined;
  const prefixUrl = getPrefixUrl(env);

  const bucket = new Bucket(scope, stackBucketName, {
    removalPolicy: RemovalPolicy.DESTROY,
    websiteRoutingRules,
    bucketName: stackBucketName,
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: `${prefixUrl}/404/index.html`,
    blockPublicAccess: new BlockPublicAccess({
      blockPublicAcls: false,
      blockPublicPolicy: false,
      ignorePublicAcls: false,
      restrictPublicBuckets: false,
    }),
  });

  return bucket;
}

export function getMongoDocsBucketRoutingRules(env: AutoBuilderEnv): RoutingRule[] {
  const hostName = getHostUrl(env);
  const prefixUrl = getPrefixUrl(env);
  // docs-mongodb-org has specific routing roles that the rest of the buckets do not have
  const websiteRoutingRules: RoutingRule[] = [
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
        keyPrefixEquals: `${prefixUrl}/atlas/cli/v1.1.4`,
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
  return websiteRoutingRules;
}
