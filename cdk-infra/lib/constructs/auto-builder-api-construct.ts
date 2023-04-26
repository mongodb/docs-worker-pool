import { Cors, CorsOptions, LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import path = require('path');

const HANDLERS_FILE_PATH = '/../../../api/controllers/v1';

interface AutoBuilderApiConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}
export class AutoBuilderApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: AutoBuilderApiConstructProps) {
    super(scope, id);

    // this is for issues with bundling .node files that exist within
    // some of the dependencies in the node_modules
    // .node files are binaries which esbuild doesn't handle out
    // of the box
    const bundling = {
      loader: {
        '.node': 'file',
      },
    };

    const dbName = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/dbname');

    const slackTriggerLambda = new NodejsFunction(this, 'slackTriggerLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/slack.ts`),
      runtime: Runtime.NODEJS_14_X,
      handler: 'DeployRepo',
      environment: {
        DB_NAME: dbName,
      },
      bundling,
    });

    const slackDisplayRepoLambda = new NodejsFunction(this, 'slackDisplayRepoLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/slack.ts`),
      runtime: Runtime.NODEJS_14_X,
      handler: 'DisplayRepoOptions',
      environment: {
        DB_NAME: dbName,
      },
      bundling,
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
      handler: 'UpsertEdgeDictionaryItem',
      environment: {
        FASTLY_DOCHUB_MAP: fastlyDochubMap,
        FASTLY_DOCHUB_SERVICE_ID: fastlyDochubServiceId,
        FASTLY_DOCHUB_TOKEN: fastlyDochubToken,
      },
      bundling,
    });

    const githubTriggerLambda = new NodejsFunction(this, 'githubTriggerLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/github.ts`),
      bundling,
      runtime: Runtime.NODEJS_14_X,
      handler: 'TriggerBuild',
    });

    const triggerLocalBuildLambda = new NodejsFunction(this, 'triggerLocalBuildLambda', {
      entry: path.join(__dirname, `${HANDLERS_FILE_PATH}/jobs.ts`),
      runtime: Runtime.NODEJS_14_X,
      handler: 'TriggerLocalBuild',
      bundling,
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

    const webhookEndpoint = restApi.root.addResource('webhook');

    const slackEndpoint = webhookEndpoint.addResource('slack');
    const dochubEndpoint = webhookEndpoint.addResource('dochub');
    const githubEndpoint = webhookEndpoint.addResource('githubEndpoint');
    const localEndpoint = webhookEndpoint.addResource('local');

    const defaultCorsPreflightOptions: CorsOptions = {
      allowOrigins: Cors.ALL_ORIGINS,
    };

    // add resources and post methods for trigger endpoints
    slackEndpoint
      .addResource('trigger')
      .addResource('build', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(slackTriggerLambda));

    slackEndpoint
      .addResource('display')
      .addResource('repos', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(slackDisplayRepoLambda));

    dochubEndpoint
      .addResource('trigger')
      .addResource('upsert', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(dochubTriggerUpsertLambda));

    githubEndpoint
      .addResource('trigger')
      .addResource('build', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(githubTriggerLambda));

    localEndpoint
      .addResource('trigger')
      .addResource('build', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(triggerLocalBuildLambda));

    const { jobsQueue, jobUpdatesQueue } = props;

    // grant permission for lambdas to enqueue messages to the jobs queue
    jobsQueue.grantSendMessages(slackTriggerLambda);
    jobsQueue.grantSendMessages(githubTriggerLambda);
    jobsQueue.grantSendMessages(triggerLocalBuildLambda);

    // grant permission for lambdas to enqueue messages to the job updates queue
    jobUpdatesQueue.grantSendMessages(triggerLocalBuildLambda);
  }
}
