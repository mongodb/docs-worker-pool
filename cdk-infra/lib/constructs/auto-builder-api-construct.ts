import { Cors, CorsOptions, LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BundlingOptions, NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import path = require('path');

const HANDLERS_PATH = path.join(__dirname, '/../../../api/controllers/v1/');

const bundling: BundlingOptions = {
  sourceMap: true,
  minify: true,
  loader: {
    '.node': 'file',
  },
  commandHooks: {
    beforeBundling: (inputDir: string, outputDir: string): string[] => {
      return [`cp -a ${inputDir}/static/api/config ${outputDir}`];
    },
    afterBundling: (): string[] => [],
    beforeInstall: (): string[] => [],
  },
};

const runtime = Runtime.NODEJS_18_X;

interface AutoBuilderApiConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}

export class AutoBuilderApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: AutoBuilderApiConstructProps) {
    super(scope, id);

    const dbName = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/dbname');
    const dbUsername = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/username');
    const dbHost = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/host');
    const dbPassword = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/password');
    const slackSecret = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/slack/webhook/secret');
    const slackAuthToken = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/slack/auth/token');

    // retrieving queues
    const { jobsQueue, jobUpdatesQueue } = props;
    const slackEnvironment = {
      MONGO_ATLAS_URL: `mongodb+srv://${dbUsername}:${dbPassword}@${dbHost}/admin?retryWrites=true`,
      DB_NAME: dbName,
      SLACK_SECRET: slackSecret,
      SLACK_TOKEN: slackAuthToken,
      NODE_CONFIG_DIR: './api/config',
      JOBS_QUEUE_URL: jobsQueue.queueUrl,
      JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
    };

    const slackTriggerLambda = new NodejsFunction(this, 'slackTriggerLambda', {
      entry: `${HANDLERS_PATH}/slack.ts`,
      runtime,
      handler: 'DeployRepo',
      environment: slackEnvironment,
      bundling,
    });

    const slackDisplayRepoLambda = new NodejsFunction(this, 'slackDisplayRepoLambda', {
      entry: `${HANDLERS_PATH}/slack.ts`,
      runtime,
      handler: 'DeployRepoDisplayRepoOptions',
      environment: slackEnvironment,
      bundling,
    });

    const fastlyDochubToken = StringParameter.fromSecureStringParameterAttributes(this, 'fastlyDochubToken', {
      parameterName: '/env/dev/docs/worker_pool/fastly/docs/dochub/token',
    });
    const fastlyDochubServiceId = StringParameter.fromSecureStringParameterAttributes(this, 'fastlyDochubServiceId', {
      parameterName: '/env/dev/docs/worker_pool/fastly/docs/dochub/service_id',
    });
    const fastlyDochubMap = StringParameter.fromSecureStringParameterAttributes(this, 'fastlyDochubMap', {
      parameterName: '/env/dev/docs/worker_pool/fastly/dochub_map',
    });

    const dochubTriggerUpsertLambda = new NodejsFunction(this, 'dochubTriggerUpsertLambda', {
      entry: `${HANDLERS_PATH}/dochub.ts`,
      runtime,
      handler: 'UpsertEdgeDictionaryItem',
      environment: {
        FASTLY_DOCHUB_MAP: fastlyDochubMap.parameterName,
        FASTLY_DOCHUB_SERVICE_ID: fastlyDochubServiceId.parameterName,
        FASTLY_DOCHUB_TOKEN: fastlyDochubToken.parameterName,
        NODE_CONFIG_DIR: './api/config',
      },
    });

    fastlyDochubToken.grantRead(dochubTriggerUpsertLambda);
    fastlyDochubServiceId.grantRead(dochubTriggerUpsertLambda);
    fastlyDochubMap.grantRead(dochubTriggerUpsertLambda);

    const githubTriggerLambda = new NodejsFunction(this, 'githubTriggerLambda', {
      entry: `${HANDLERS_PATH}/github.ts`,
      runtime,
      handler: 'TriggerBuild',
      bundling,
    });

    const triggerLocalBuildLambda = new NodejsFunction(this, 'triggerLocalBuildLambda', {
      entry: `${HANDLERS_PATH}/jobs.ts`,
      runtime,
      handler: 'TriggerLocalBuild',
      environment: {
        JOB_UPDATES_QUEUE_URL: jobUpdatesQueue.queueUrl,
      },
      bundling,
    });

    // generic handler for the root endpoint
    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime,
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

    // grant permission for lambdas to enqueue messages to the jobs queue
    jobsQueue.grantSendMessages(slackTriggerLambda);
    jobsQueue.grantSendMessages(githubTriggerLambda);
    jobsQueue.grantSendMessages(triggerLocalBuildLambda);

    // grant permission for lambdas to enqueue messages to the job updates queue
    jobUpdatesQueue.grantSendMessages(triggerLocalBuildLambda);
  }
}
