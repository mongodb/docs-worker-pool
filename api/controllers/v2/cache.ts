import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

import { RepoInfo } from '../../../src/cache-updater/index';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';

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
  const TASK_DEFINITION = process.env.TASK_DEFINITION;
  const CONTAINER_NAME = process.env.CONTAINER_NAME;
  const CLUSTER = process.env.CLUSTER;

  if (!TASK_DEFINITION) throw new Error('ERROR! process.env.TASK_DEFINITION is not defined');
  if (!CONTAINER_NAME) throw new Error('ERROR! process.env.CONTAINER_NAME is not defined');
  if (!CLUSTER) throw new Error('ERROR! process.env.CLUSTER is not defined');

  const client = new ECSClient({
    region: 'us-east-2',
  });

  const command = new RunTaskCommand({
    taskDefinition: TASK_DEFINITION,
    cluster: CLUSTER,
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
 * @param {APIGatewayEvent} event
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
