import { Duration } from 'aws-cdk-lib';
import { DockerImageFunction, DockerImageCode } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import path from 'path';

export class CacheUpdaterApiConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new DockerImageFunction(this, 'cacheUpdaterLambda', {
      timeout: Duration.minutes(3),
      memorySize: 2048,
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../../../'), {
        buildArgs: {
          SNOOTY_PARSER_VERSION: '0.15.2',
        },
        file: 'api/handlers/cache-updater/Dockerfile.cacheUpdater',
      }),
    });
  }
}
