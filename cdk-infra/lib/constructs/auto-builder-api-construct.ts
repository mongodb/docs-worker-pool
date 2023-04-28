import { Cors, CorsOptions, LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import path = require('path');

const HANDLERS_FILE_PATH = path.join(__dirname, '../../../build.zip');
const API_DIR_PATH = 'api/controllers/v1';

interface AutoBuilderApiConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
}
export class AutoBuilderApiConstruct extends Construct {
  constructor(scope: Construct, id: string, props: AutoBuilderApiConstructProps) {
    super(scope, id);

    // this Code object contains a bundle of all of the lambdas
    // each lambda function will reference this bundle for the source code
    const code = Code.fromAsset(HANDLERS_FILE_PATH);

    const dbName = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/dbname');
    const dbUsername = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/username');
    const dbHost = StringParameter.valueFromLookup(this, '/env/dev/docs/worker_pool/atlas/host');

    const dbPassword = StringParameter.fromSecureStringParameterAttributes(this, 'dbPassword', {
      parameterName: '/env/dev/docs/worker_pool/atlas/password',
    }).stringValue;
    const slackSecret = StringParameter.fromSecureStringParameterAttributes(this, 'slackSecret', {
      parameterName: '/env/dev/docs/worker_pool/slack/webhook/secret',
    }).stringValue;
    const slackAuthToken = StringParameter.fromSecureStringParameterAttributes(this, 'slackAuthToken', {
      parameterName: '/env/dev/docs/worker_pool/slack/auth/token',
    }).stringValue;

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

    const slackTriggerLambda = new Function(this, 'slackTriggerLambda', {
      code,
      runtime: Runtime.NODEJS_14_X,
      handler: `${API_DIR_PATH}/slack.DeployRepo`,
      environment: slackEnvironment,
    });

    const slackDisplayRepoLambda = new Function(this, 'slackDisplayRepoLambda', {
      code,
      runtime: Runtime.NODEJS_14_X,
      handler: `${API_DIR_PATH}/slack.DeployRepoDisplayRepoOptions`,
      environment: slackEnvironment,
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

    const dochubTriggerUpsertLambda = new Function(this, 'dochubTriggerUpsertLambda', {
      code,
      runtime: Runtime.NODEJS_14_X,
      handler: `${API_DIR_PATH}/dochub.UpsertEdgeDictionaryItem`,
      environment: {
        FASTLY_DOCHUB_MAP: fastlyDochubMap,
        FASTLY_DOCHUB_SERVICE_ID: fastlyDochubServiceId,
        FASTLY_DOCHUB_TOKEN: fastlyDochubToken,
        NODE_CONFIG_DIR: './api/config',
      },
    });

    const githubTriggerLambda = new Function(this, 'githubTriggerLambda', {
      code,
      runtime: Runtime.NODEJS_14_X,
      handler: `${API_DIR_PATH}/github.TriggerBuild`,
    });

    const triggerLocalBuildLambda = new Function(this, 'triggerLocalBuildLambda', {
      code,
      runtime: Runtime.NODEJS_14_X,
      handler: `${API_DIR_PATH}/jobs.TriggerLocalBuild`,
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

    // grant permission for lambdas to enqueue messages to the jobs queue
    jobsQueue.grantSendMessages(slackTriggerLambda);
    jobsQueue.grantSendMessages(githubTriggerLambda);
    jobsQueue.grantSendMessages(triggerLocalBuildLambda);

    // grant permission for lambdas to enqueue messages to the job updates queue
    jobUpdatesQueue.grantSendMessages(triggerLocalBuildLambda);
  }
}
