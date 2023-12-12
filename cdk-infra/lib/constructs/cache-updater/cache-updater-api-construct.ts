import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { DockerImageFunction, DockerImageCode } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import path from 'path';

export class CacheUpdaterConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new DockerImageFunction(this, 'cacheUpdaterLambda', {
      code: DockerImageCode.fromImageAsset(path.join(__dirname, '../../../../'), {
        buildArgs: {
          SNOOTY_PARSER_VERSION: '0.15.0',
        },
        platform: Platform.LINUX_AMD64,
        file: 'api/handlers/cache-updater/Dockerfile.cacheUpdater',
      }),
    });
  }
}
