import * as c from 'config';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { APIGatewayEvent } from 'aws-lambda';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { MetadataRepository } from '../../../src/repositories/metadataRepository';
import { UpdatedDocsRepository } from '../../../src/repositories/updatedDocsRepository';

// This function will validate your payload from GitHub
// See docs at https://developer.github.com/webhooks/securing/#validating-payloads-from-github
function validateJsonWebhook(request: any, secret: string) {
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(request.body).digest('hex');
  const signature = request.headers['X-Hub-Signature-256'];
  if (signature !== expectedSignature) {
    return false;
  }
  return true;
}

async function prepGithubPushPayload(githubEvent: any, branchRepository: BranchRepository, prefix: string) {
  const branch_name = githubEvent.ref.split('/')[2];
  const branch_info = await branchRepository.getRepoBranchAliases(githubEvent.repository.name, branch_name);
  const urlSlug = branch_info.aliasObject?.urlSlug ?? branch_name;
  const repo_info = await branchRepository.getRepo(githubEvent.repository.name);
  const project = repo_info?.project ?? githubEvent.repository.name;

  return {
    title: githubEvent.repository.full_name,
    user: githubEvent.pusher.name,
    email: githubEvent.pusher.email,
    status: 'inQueue',
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    buildDepsExeStartTime: 0,
    buildDepsExeEndTime: 0,
    parseExeStartTime: 0,
    parseExeEndTime: 0,
    htmlExeStartTime: 0,
    htmlExeEndTime: 0,
    oasPageBuildExeStartTime: 0,
    oasPageBuildExeEndTime: 0,
    payload: {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName: githubEvent.repository.name,
      branchName: githubEvent.ref.split('/')[2],
      isFork: githubEvent.repository.fork,
      isXlarge: true,
      repoOwner: githubEvent.repository.owner.login,
      url: githubEvent.repository.clone_url,
      newHead: githubEvent.after,
      urlSlug: urlSlug,
      prefix: prefix,
      project: project,
    },
    logs: [],
  };
}

export const TriggerBuild = async (event: any = {}, context: any = {}): Promise<any> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);

  if (!validateJsonWebhook(event, c.get<string>('githubSecret'))) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }
  const body = JSON.parse(event.body);

  if (body.deleted) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Job Ignored (Deletion)',
    };
  }

  const env = c.get<string>('env');
  const repoInfo = await branchRepository.getRepo(body.repository.name);
  const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
  // TODO: Make job be of type Job
  const job = await prepGithubPushPayload(body, branchRepository, jobPrefix);
  try {
    consoleLogger.info(job.title, 'Creating Job');
    const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
    consoleLogger.info(job.title, `Created Job ${jobId}`);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }
  return {
    statusCode: 202,
    headers: { 'Content-Type': 'text/plain' },
    body: 'Job Queued',
  };
};

/**
 * Deletes build artifacts for a given project + branch combination.
 * @param event
 */
export const MarkBuildArtifactsForDeletion = async (event: APIGatewayEvent) => {
  const consoleLogger = new ConsoleLogger();
  const defaultHeaders = { 'Content-Type': 'text/plain' };

  const ghEventType = event.headers['X-GitHub-Event'];
  if (ghEventType !== 'pull_request') {
    const errMsg = 'GitHub event type is not of type "pull_request"';
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }

  if (!validateJsonWebhook(event, c.get<string>('githubDeletionSecret'))) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
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
    await Promise.all([
      updatedDocsRepository.marksAstsForDeletion(project, branch),
      metadataRepository.marksMetadataForDeletion(project, branch),
    ]);
  } catch (e) {
    consoleLogger.error('SnootyBuildCompleteError', e);
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
