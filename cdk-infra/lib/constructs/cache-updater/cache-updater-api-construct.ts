import { Duration } from 'aws-cdk-lib';
import {
  ApiKeySourceType,
  Cors,
  LambdaIntegration,
  LambdaRestApi,
  LogGroupLogDestination,
} from 'aws-cdk-lib/aws-apigateway';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import path from 'path';

interface CacheUpdaterApiConstructProps {
  clusterName: string;
  taskDefinition: TaskDefinition;
  containerName: string;
  vpc: Vpc;
  githubSecret: string;
}

const HANDLERS_PATH = path.join(__dirname, '/../../../../api/controllers/v2');

/**
 * This stack creates the resources for the Snooty Parser cache updater.
 */
export class CacheUpdaterApiConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    { clusterName, taskDefinition, containerName, vpc, githubSecret }: CacheUpdaterApiConstructProps
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
        SUBNETS: JSON.stringify(vpc.privateSubnets.map((subnet) => subnet.subnetId)),
      },
    });

    const cacheGithubWebhookLambda = new NodejsFunction(this, 'cacheUpdaterGithubWebhookLambda', {
      entry: `${HANDLERS_PATH}/cache.ts`,
      handler: 'rebuildCacheGithubWebhookHandler',
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.minutes(2),
      memorySize: 1024,
      environment: {
        CLUSTER: clusterName,
        TASK_DEFINITION: taskDefinition.taskDefinitionArn,
        CONTAINER_NAME: containerName,
        SUBNETS: JSON.stringify(vpc.privateSubnets.map((subnet) => subnet.subnetId)),
        GITHUB_SECRET: githubSecret,
      },
    });

    taskDefinition.grantRun(cacheWebhookLambda);
    taskDefinition.grantRun(cacheGithubWebhookLambda);

    // generic handler for the root endpoint
    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime: Runtime.NODEJS_18_X,
      handler: 'RootEndpointLambda',
    });

    const apiLogGroup = new LogGroup(this, 'cacheUpdaterLogGroup');

    const restApi = new LambdaRestApi(this, 'cacheUpdaterRestApi', {
      handler: rootEndpointLambda,
      proxy: false,
      apiKeySourceType: ApiKeySourceType.HEADER,
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(apiLogGroup),
      },
    });

    const webhook = restApi.root.addResource('webhook', {
      defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
    });

    webhook.addMethod('POST', new LambdaIntegration(cacheWebhookLambda), { apiKeyRequired: true });

    const usagePlan = restApi.addUsagePlan('cacheUpdaterUsagePlan', {
      name: 'defaultPlan',
      apiStages: [
        {
          api: restApi,
          stage: restApi.deploymentStage,
        },
      ],
    });

    const apiKey = restApi.addApiKey('cacheUpdaterApiKey');

    usagePlan.addApiKey(apiKey);

    const githubWebhook = webhook.addResource('github', {
      defaultCorsPreflightOptions: { allowOrigins: Cors.ALL_ORIGINS },
    });

    githubWebhook.addMethod('POST', new LambdaIntegration(cacheGithubWebhookLambda), { apiKeyRequired: false });
  }
}
