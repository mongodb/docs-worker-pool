import { LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class WebhookConstruct extends Construct {
  private readonly jobQueue: IQueue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const slackLambda = new Function(this, 'slackLambda', {
      code: Code.fromAsset('../build/controllers/v1/slack.zip'),
      runtime: Runtime.NODEJS_14_X,
      handler: 'slackLambda',
    });

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

    slackEndpoint.addResource('trigger').addMethod('POST', new LambdaIntegration(slackLambda));

    const jobQueue = new Queue(this, 'JobQueue');

    this.jobQueue = jobQueue;
  }
}
