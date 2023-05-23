const docsBucketNames = [
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
];

export function getBucketNamesForEnv(env: string): string[] {
  return docsBucketNames.map((bucketName) => `${bucketName}-${env}`);
}
