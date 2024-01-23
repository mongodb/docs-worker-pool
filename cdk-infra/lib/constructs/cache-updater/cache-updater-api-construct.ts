import { Duration } from 'aws-cdk-lib';
import { Cors, LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path from 'path';

interface CacheUpdaterApiConstructProps {
  clusterName: string;
  taskDefinition: TaskDefinition;
  containerName: string;
}

const HANDLERS_PATH = path.join(__dirname, '/../../../../api/controllers/v2');

export class CacheUpdaterApiConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    { clusterName, taskDefinition, containerName }: CacheUpdaterApiConstructProps
  ) {
    super(scope, id);

    const cacheWebhookLambda = new NodejsFunction(this, 'cacheUpdaterWebhookLambda', {
      entry: `${HANDLERS_PATH}/cache.ts`,
      handler: 'rebuildCacheHandler',
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.minutes(2),
      memorySize: 1024,
      environment: {
        CLUSTER: clusterName,
        TASK_DEFINITION: taskDefinition.taskDefinitionArn,
        CONTAINER_NAME: containerName,
      },
    });

    taskDefinition.grantRun(cacheWebhookLambda);

    // generic handler for the root endpoint
    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime: Runtime.NODEJS_18_X,
      handler: 'RootEndpointLambda',
    });

    const restApi = new LambdaRestApi(this, 'cacheUpdaterRestApi', { handler: rootEndpointLambda, proxy: false });

    restApi.root
      .addResource('webhook', {
        defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
      })
      .addMethod('POST', new LambdaIntegration(cacheWebhookLambda));
  }
}
