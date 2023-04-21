import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct, Node } from 'constructs';

export class WebhookConstruct extends Construct {
  private readonly jobQueue: IQueue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const jobQueue = new Queue(this, 'JobQueue');

    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime: Runtime.NODEJS_14_X,
      handler: 'RootEndpointLambda',
    });

    const restApi = new LambdaRestApi(this, 'webhookHandlers', {
      handler: rootEndpointLambda,
    });

    this.jobQueue = jobQueue;
  }
}
