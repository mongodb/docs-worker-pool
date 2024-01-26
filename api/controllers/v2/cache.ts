import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

import { RepoInfo } from '../../../src/cache-updater/index';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { validateJsonWebhook } from '../../handlers/github';
import { PushEvent } from '@octokit/webhooks-types';

/**
 * validates request
 * @param body The result of calling `JSON.parse` on the `event.body`.
 * @returns a boolean representing whether or not we have a valid rebuild request.
 */
function isRebuildRequest(body: unknown): body is RepoInfo[] {
  // if body is falsy (e.g. 0, '', undefined, null, etc.), it's not valid here.
  if (!body || typeof body !== 'object') return false;

  // if we get an array of sites to rebuild, check to make sure
  // they are correctly formatted.
  try {
    const repoInfos = body as RepoInfo[];

    // Array.prototype.every returns true if every value returned from the callback is true, otherwise it'll return false.
    return repoInfos.every(({ repoOwner, repoName }) => typeof repoOwner === 'string' && typeof repoName === 'string');
  } catch {
    // if we get an error, the data is probably wrong, so we can return false here.
    return false;
  }
}

async function runCacheRebuildJob(repos: RepoInfo[]) {
  const { TASK_DEFINITION, CONTAINER_NAME, CLUSTER, SUBNETS } = process.env;

  if (!TASK_DEFINITION) throw new Error('ERROR! process.env.TASK_DEFINITION is not defined');
  if (!CONTAINER_NAME) throw new Error('ERROR! process.env.CONTAINER_NAME is not defined');
  if (!CLUSTER) throw new Error('ERROR! process.env.CLUSTER is not defined');
  if (!SUBNETS) throw new Error('ERROR! process.env.SUBNETS is not defined');

  const client = new ECSClient({
    region: 'us-east-2',
  });

  const command = new RunTaskCommand({
    taskDefinition: TASK_DEFINITION,
    cluster: CLUSTER,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: JSON.parse(SUBNETS),
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: CONTAINER_NAME,
          environment: [
            {
              name: 'REPOS',
              value: JSON.stringify(repos),
            },
          ],
        },
      ],
    },
  });

  await client.send(command);
}

/**
 * Handles requests from individual doc sites and when the docs-worker-pool repository has a release with an updated Snooty Parser version.
 * In the latter case, we should receive an event to build all doc site caches.
 * @param {APIGatewayEvent} event An event object that comes from either a webhook payload or from the custom GitHub Action for the docs-worker pool.
 *
 * In either scenario, the body should contain an array of RepoInfo objects.
 * @returns {Promise<APIGatewayProxyResult>}
 */
export async function rebuildCacheHandler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    const errorMessage = 'Error! No body found in event payload.';
    console.error(errorMessage);
    return {
      statusCode: 400,
      body: errorMessage,
    };
  }

  const rebuildRequest = JSON.parse(event.body);

  if (!isRebuildRequest(rebuildRequest)) {
    const errorMessage = 'Error! Invalid rebuild request.';
    console.error(errorMessage);
    return {
      statusCode: 400,
      body: errorMessage,
    };
  }

  try {
    await runCacheRebuildJob(rebuildRequest);
    return {
      statusCode: 200,
      body: 'Cache rebuild job successfully created',
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: 'Error occurred when starting cache rebuild job',
    };
  }
}

/**
 * This is for the GitHub webhooks. The GitHub webhooks will be used by individual doc sites to rebuild the cache if
 * the snooty.toml file is modified.
 * @param {APIGatewayEvent} event GitHub webhook push event. Body should be a PushEvent type.
 * @returns {Promise<APIGatewayProxyResult>}
 */
export async function rebuildCacheGithubWebhookHandler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    const errorMessage = 'Error! No body found in event payload.';
    console.error(errorMessage);
    return {
      statusCode: 400,
      body: errorMessage,
    };
  }

  let body: PushEvent;
  try {
    body = JSON.parse(event.body) as PushEvent;
  } catch (e) {
    console.log('[TriggerBuild]: ERROR! Could not parse event.body', e);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain' },
      body: ' ERROR! Could not parse event.body',
    };
  }

  const repoOwner = body.repository.owner.login;
  const repoName = body.repository.name;

  // Checks the commits to see if there have been changes made to the snooty.toml file.
  const snootyTomlChanged = body.commits.some(
    (commit) =>
      commit.added.some((fileName) => fileName === 'snooty.toml') ||
      commit.removed.some((fileName) => fileName === 'snooty.toml') ||
      commit.modified.some((fileName) => fileName === 'snooty.toml')
  );

  if (!snootyTomlChanged) {
    return { statusCode: 202, body: 'snooty.toml has not changed, no need to rebuild cache' };
  }

  const ref = body.ref;
  // For webhook requests, this should only run on the primary branch, and if the repository belongs to the 10gen or mongodb orgs.
  if ((ref !== 'refs/head/master' && ref !== 'refs/head/main') || (repoOwner !== '10gen' && repoOwner !== 'mongodb')) {
    return {
      statusCode: 403,
      body: 'Cache job not processed because the request is not for the primary branch and/or the repository does not belong to the 10gen or mongodb organizations',
    };
  }

  const cacheUpdateBody = JSON.stringify([{ repoOwner, repoName }]);
  const { GITHUB_SECRET } = process.env;

  if (!GITHUB_SECRET) {
    console.error('GITHUB_SECRET is not defined');
    return {
      statusCode: 500,
      body: 'internal server error',
    };
  }

  if (!validateJsonWebhook(event, GITHUB_SECRET)) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }
  return rebuildCacheHandler({ ...event, body: cacheUpdateBody });
}
