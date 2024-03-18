import { Duration } from 'aws-cdk-lib';
import { Cors, CorsOptions, LambdaIntegration, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { BundlingOptions, NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path from 'path';
import { getFeatureName } from '../../../utils/env';

const HANDLERS_PATH = path.join(__dirname, '/../../../../api/controllers/v2');

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

interface WebhookApiConstructProps {
  jobsQueue: IQueue;
  jobUpdatesQueue: IQueue;
  environment: Record<string, string>;
}

export class WebhookApiConstruct extends Construct {
  constructor(scope: Construct, id: string, { jobsQueue, jobUpdatesQueue, environment }: WebhookApiConstructProps) {
    super(scope, id);

    const timeout = Duration.minutes(2);

    const slackTriggerLambda = new NodejsFunction(this, 'slackTriggerLambda', {
      entry: `${HANDLERS_PATH}/slack.ts`,
      runtime,
      handler: 'DeployRepo',
      environment,
      bundling,
      timeout,
    });

    const slackDisplayRepoLambda = new NodejsFunction(this, 'slackDisplayRepoLambda', {
      entry: `${HANDLERS_PATH}/slack.ts`,
      runtime,
      handler: 'DeployRepoDisplayRepoOptions',
      environment,
      bundling,
      timeout,
    });

    const dochubTriggerUpsertLambda = new NodejsFunction(this, 'dochubTriggerUpsertLambda', {
      entry: `${HANDLERS_PATH}/dochub.ts`,
      runtime,
      handler: 'UpsertEdgeDictionaryItem',
      environment,
      timeout,
    });

    const githubTriggerLambda = new NodejsFunction(this, 'githubTriggerLambda', {
      entry: `${HANDLERS_PATH}/github.ts`,
      runtime,
      handler: 'TriggerBuild',
      bundling,
      environment,
      timeout,
    });

    const githubSmokeTestBuildLambda = new NodejsFunction(this, 'githubSmokeTestBuildLambda', {
      entry: `${HANDLERS_PATH}/github.ts`,
      runtime,
      handler: 'triggerSmokeTestAutomatedBuild',
      bundling,
      environment,
      timeout,
    });

    const githubDeleteArtifactsLambda = new NodejsFunction(this, 'githubDeleteArtifactsLambda', {
      entry: `${HANDLERS_PATH}/github.ts`,
      runtime,
      handler: 'MarkBuildArtifactsForDeletion',
      bundling,
      environment,
      timeout,
    });

    const triggerLocalBuildLambda = new NodejsFunction(this, 'triggerLocalBuildLambda', {
      entry: `${HANDLERS_PATH}/jobs.ts`,
      runtime,
      handler: 'TriggerLocalBuild',
      environment,
      bundling,
      timeout,
    });

    const handleJobsLambda = new NodejsFunction(this, 'handleJobsLambda', {
      entry: `${HANDLERS_PATH}/jobs.ts`,
      runtime,
      handler: 'HandleJobs',
      environment,
      bundling,
      timeout,
    });

    const snootyBuildCompleteLambda = new NodejsFunction(this, 'snootyBuildCompleteLambda', {
      entry: `${HANDLERS_PATH}/jobs.ts`,
      runtime,
      handler: 'SnootyBuildComplete',
      environment,
      bundling,
      timeout,
    });

    // generic handler for the root endpoint
    const rootEndpointLambda = new Function(this, 'RootEndpointLambda', {
      code: Code.fromInline('exports.default = (event) => { console.log("hello, world!!"); }'),
      runtime,
      handler: 'RootEndpointLambda',
      timeout,
    });

    const apiName = `webhookHandlers-${getFeatureName()}`;

    const restApi = new LambdaRestApi(this, apiName, {
      handler: rootEndpointLambda,
      proxy: false,
    });

    const webhookEndpoint = restApi.root.addResource('webhook');

    const slackEndpoint = webhookEndpoint.addResource('slack');
    const dochubEndpoint = webhookEndpoint.addResource('dochub');
    const githubEndpoint = webhookEndpoint.addResource('githubEndpoint');
    const localEndpoint = webhookEndpoint.addResource('local');
    const snootyEndpoint = webhookEndpoint.addResource('snooty');

    // Shared /githubEndpoint/trigger endpoint
    const githubEndpointTrigger = githubEndpoint.addResource('trigger');

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

    githubEndpointTrigger
      .addResource('build', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(githubTriggerLambda));

    // add endpoint for automated testing
    githubEndpointTrigger
      .addResource('smoke-test-build', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(githubSmokeTestBuildLambda));

    githubEndpointTrigger
      .addResource('delete', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(githubDeleteArtifactsLambda));

    localEndpoint
      .addResource('trigger')
      .addResource('build', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(triggerLocalBuildLambda));

    snootyEndpoint
      .addResource('trigger')
      .addResource('complete', { defaultCorsPreflightOptions })
      .addMethod('POST', new LambdaIntegration(snootyBuildCompleteLambda));

    // grant permission for lambdas to enqueue messages to the jobs queue
    jobsQueue.grantSendMessages(slackTriggerLambda);
    jobsQueue.grantSendMessages(githubSmokeTestBuildLambda);
    jobsQueue.grantSendMessages(githubTriggerLambda);
    jobsQueue.grantSendMessages(triggerLocalBuildLambda);

    // grant permission for lambdas to enqueue messages to the job updates queue
    jobUpdatesQueue.grantSendMessages(slackTriggerLambda);
    jobUpdatesQueue.grantSendMessages(githubSmokeTestBuildLambda);
    jobUpdatesQueue.grantSendMessages(githubTriggerLambda);
    jobUpdatesQueue.grantSendMessages(triggerLocalBuildLambda);

    // grant permission to read from jobUpdatesQueue
    jobUpdatesQueue.grantConsumeMessages(handleJobsLambda);

    const handleJobsQueueSource = new SqsEventSource(jobUpdatesQueue);

    handleJobsLambda.addEventSource(handleJobsQueueSource);
  }
}
