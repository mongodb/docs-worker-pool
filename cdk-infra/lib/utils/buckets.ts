import { Bucket } from 'aws-cdk-lib/aws-s3';

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
] as const;

export type DocsBucketName = typeof docsBucketNames[number];
export type DocsBucketMap = { [BucketName in DocsBucketName]+?: Bucket };
