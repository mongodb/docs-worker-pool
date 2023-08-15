import * as c from 'config';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { APIGatewayEvent } from 'aws-lambda';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { ConsoleLogger } from '../../src/services/logger';
import { RepoBranchesRepository } from '../../src/repositories/repoBranchesRepository';
import { UpdatedDocsRepository } from '../../src/repositories/updatedDocsRepository';
import { MetadataRepository } from '../../src/repositories/metadataRepository';

// This function will validate your payload from GitHub
// See docs at https://developer.github.com/webhooks/securing/#validating-payloads-from-github
export function validateJsonWebhook(request: APIGatewayEvent, secret: string) {
  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(request.body ?? '')
      .digest('hex');
  const signature = request.headers['X-Hub-Signature-256'];
  if (signature !== expectedSignature) {
    return false;
  }
  return true;
}

/**
 * Deletes build artifacts for a given project + branch combination.
 * @param event
 */
export const markBuildArtifactsForDeletion = async (event: APIGatewayEvent) => {
  const consoleLogger = new ConsoleLogger();
  const defaultHeaders = { 'Content-Type': 'text/plain' };

  const ghEventType = event.headers['X-GitHub-Event'];
  if (ghEventType !== 'pull_request') {
    const errMsg = 'GitHub event type is not of type "pull_request"';
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  if (!validateJsonWebhook(event, c.get<string>('githubDeletionSecret'))) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  if (!event.body) {
    const err = 'MarkBuildArtifactsForDeletion does not have a body in event payload';
    consoleLogger.error('MarkBuildArtifactsForDeletion', err);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: err,
    };
  }

  let payload: PullRequestEvent | undefined;
  try {
    payload = JSON.parse(event.body) as PullRequestEvent;
  } catch (e) {
    const errMsg = 'Payload is not valid JSON';
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  // Setting a webhook for PR events can have different actions: closed, opened, etc.
  // The "closed" action should occur whenever a PR is closed, regardless of merge or not.
  const { action } = payload;
  if (action !== 'closed') {
    const errMsg = `Unexpected GitHub action: ${action}`;
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  const { repository, pull_request: pullRequest } = payload;
  const branch = pullRequest.head.ref;
  const user = pullRequest.user.login;

  const client = new mongodb.MongoClient(c.get('dbUrl'));

  try {
    await client.connect();
    const poolDb = client.db(c.get('dbName'));
    const repoBranchesRepository = new RepoBranchesRepository(poolDb, c, consoleLogger);
    const project = (await repoBranchesRepository.getProjectByRepoName(repository.name)) as string;

    // Start marking build artifacts for deletion
    const snootyDb = client.db(c.get('snootyDbName'));
    const updatedDocsRepository = new UpdatedDocsRepository(snootyDb, c, consoleLogger);
    const metadataRepository = new MetadataRepository(snootyDb, c, consoleLogger);
    const updateTime = new Date();
    await Promise.all([
      updatedDocsRepository.markAstsForDeletion(project, branch, user, updateTime),
      metadataRepository.markMetadataForDeletion(project, branch, user, updateTime),
    ]);
  } catch (e) {
    consoleLogger.error('MarkBuildArtifactsForDeletion', e);
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: e,
    };
  } finally {
    await client.close();
  }

  return {
    statusCode: 200,
    headers: defaultHeaders,
    body: 'Build data successfully marked for deletion',
  };
};
