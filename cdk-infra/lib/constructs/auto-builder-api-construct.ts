import { Cors, CorsOptions, LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import path = require('path');

const HANDLERS_FILE_PATH = '/../../../api/controllers/v1';

export class AutoBuilderApiConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bundling = {
      loader: {
        '.node': 'file',
      },
    };

    const dbName = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/dbname');

    const slackTriggerLambda = new NodejsFunction(this, 'slackTriggerLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/slack.ts`),
      runtime: Runtime.NODEJS_14_X,
      bundling,
      handler: 'DeployRepo',
      environment: {
        DB_NAME: dbName,
      },
    });

    const fastlyDochubToken = StringParameter.fromSecureStringParameterAttributes(this, 'fastlyDochubToken', {
      parameterName: '/env/dev/docs/worker_pool/fastly/docs/dochub/token',
    }).stringValue;
    const fastlyDochubServiceId = StringParameter.fromSecureStringParameterAttributes(this, 'fastlyDochubServiceId', {
      parameterName: '/env/dev/docs/worker_pool/fastly/docs/dochub/service_id',
    }).stringValue;
    const fastlyDochubMap = StringParameter.fromSecureStringParameterAttributes(this, 'fastlyDochubMap', {
      parameterName: '/env/dev/docs/worker_pool/fastly/dochub_map',
    }).stringValue;

    const dochubTriggerUpsertLambda = new NodejsFunction(this, 'dochubTriggerUpsertLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/dochub.ts`),
      runtime: Runtime.NODEJS_14_X,
      bundling,
      handler: 'UpsertEdgeDictionaryItem',
      environment: {
        FASTLY_DOCHUB_MAP: fastlyDochubMap,
        FASTLY_DOCHUB_SERVICE_ID: fastlyDochubServiceId,
        FASTLY_DOCHUB_TOKEN: fastlyDochubToken,
      },
    });

    const githubTriggerLambda = new NodejsFunction(this, 'githubTriggerLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/github.ts`),
      bundling,
      runtime: Runtime.NODEJS_14_X,
      handler: 'TriggerBuild',
    });

    const triggerLocalBuildLambda = new NodejsFunction(this, 'triggerLocalBuildLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/jobs.ts`),
      bundling,
      runtime: Runtime.NODEJS_14_X,
      handler: 'TriggerLocalBuild',
    });

    // generic handler for the root endpoint
    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime: Runtime.NODEJS_14_X,
      handler: 'RootEndpointLambda',
    });

    const restApi = new LambdaRestApi(this, 'webhookHandlers', {
      handler: rootEndpointLambda,
      proxy: false,
    });

    const controllersEndpoint = restApi.root.addResource('controllers');
    const v1Endpoint = controllersEndpoint.addResource('v1');

    const defaultCorsPreflightOptions: CorsOptions = {
      allowOrigins: Cors.ALL_ORIGINS,
    };

    const slackEndpoint = v1Endpoint.addResource('slack', { defaultCorsPreflightOptions });
    const dochubEndpoint = v1Endpoint.addResource('dochub', { defaultCorsPreflightOptions });
    const githubEndpoint = v1Endpoint.addResource('githubEndpoint', { defaultCorsPreflightOptions });

    // add resources and post methods for trigger endpoints
    slackEndpoint.addResource('trigger').addMethod('POST', new LambdaIntegration(slackTriggerLambda));
    dochubEndpoint.addResource('upsert').addMethod('POST', new LambdaIntegration(dochubTriggerUpsertLambda));
    githubEndpoint.addResource('trigger').addMethod('POST', new LambdaIntegration(githubTriggerLambda));

    const jobsQueue = new Queue(this, 'JobsQueue');
    const jobUpdatesQueue = new Queue(this, 'JobUpdatesQueue');

    // grant permission for lambdas to enqueue messages to the jobs queue
    jobsQueue.grantSendMessages(slackTriggerLambda);
    jobsQueue.grantSendMessages(githubTriggerLambda);
    jobsQueue.grantSendMessages(triggerLocalBuildLambda);

    // grant permission for lambds to enqueue messages to the job updates queue
    jobUpdatesQueue.grantSendMessages(triggerLocalBuildLambda);
  }
}
