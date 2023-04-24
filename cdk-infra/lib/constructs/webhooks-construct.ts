import { LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class WebhookConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const slackTriggerName = 'dochubTriggerLambda';

    const slackTriggerLambda = new Function(this, slackTriggerName, {
      code: Code.fromAsset('../build/controllers/v1/handlers/slackTrigger.zip'),
      runtime: Runtime.NODEJS_14_X,
      handler: slackTriggerName,
    });

    const dochubTriggerName = 'dochubTriggerLambda';

    const dochubTriggerLambda = new Function(this, dochubTriggerName, {
      code: Code.fromAsset('../build/controllers/v1/handlers/dochubTriggerUpsert.zip'),
      runtime: Runtime.NODEJS_14_X,
      handler: dochubTriggerName,
    });

    const githubTriggerName = 'githubTriggerLambda';

    const githubTriggerLambda = new Function(this, githubTriggerName, {
      code: Code.fromAsset('../build/controllers/v1/handlers/githubTriggerBuild.zip'),
      runtime: Runtime.NODEJS_14_X,
      handler: githubTriggerName,
    });

    // generic handler for the root endpoint
    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime: Runtime.NODEJS_14_X,
      handler: 'RootEndpointLambda',
    });

    const restApi = new LambdaRestApi(this, 'webhookHandlers', {
      handler: rootEndpointLambda,
    });

    const controllersEndpoint = restApi.root.addResource('controllers');
    const v1Endpoint = controllersEndpoint.addResource('v1');

    const slackEndpoint = v1Endpoint.addResource('slack');
    const dochubEndpoint = v1Endpoint.addResource('dochub');
    const githubEndpoint = v1Endpoint.addResource('githubEndpoint');

    // add resources and post methods for trigger endpoints
    slackEndpoint.addResource('trigger').addMethod('POST', new LambdaIntegration(slackTriggerLambda));
    dochubEndpoint.addResource('trigger').addMethod('POST', new LambdaIntegration(dochubTriggerLambda));
    githubEndpoint.addResource('trigger').addMethod('POST', new LambdaIntegration(githubTriggerLambda));

    const jobQueue = new Queue(this, 'JobQueue');

    // grant permission for lambdas to enqueue messages to the queue
    jobQueue.grantSendMessages(slackTriggerLambda);
    jobQueue.grantSendMessages(dochubTriggerLambda);
    jobQueue.grantSendMessages(githubTriggerLambda);
  }
}
