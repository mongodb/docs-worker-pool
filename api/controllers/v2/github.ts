import * as c from 'config';
import * as mongodb from 'mongodb';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PushEvent } from '@octokit/webhooks-types';

import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { EnhancedJob, JobStatus } from '../../../src/entities/job';
import { markBuildArtifactsForDeletion, validateJsonWebhook } from '../../handlers/github';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';
import { getMonorepoPaths } from '../../../src/monorepo';
import { getUpdatedFilePaths } from '../../../src/monorepo/utils/path-utils';
import { ReposBranchesDocsetsDocument } from '../../../modules/persistence/src/services/metadata/repos_branches';
import { MONOREPO_NAME } from '../../../src/monorepo/utils/monorepo-constants';

async function prepGithubPushPayload(
  githubEvent: PushEvent,
  repoBranchesRepository: RepoBranchesRepository,
  prefix: string,
  repoInfo: ReposBranchesDocsetsDocument
): Promise<Omit<EnhancedJob, '_id'>> {
  const branch_name = githubEvent.ref.split('/')[2];
  const branch_info = await repoBranchesRepository.getRepoBranchAliases(
    githubEvent.repository.name,
    branch_name,
    repoInfo.project
  );
  const urlSlug = branch_info.aliasObject?.urlSlug ?? branch_name;
  const project = repoInfo?.project ?? githubEvent.repository.name;

  return {
    title: githubEvent.repository.full_name,
    user: githubEvent.pusher.name,
    email: githubEvent.pusher.email ?? '',
    status: JobStatus.inQueue,
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    payload: {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName: githubEvent.repository.name,
      branchName: githubEvent.ref.split('/')[2],
      isFork: githubEvent.repository.fork,
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

export const TriggerBuild = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  console.log('testing again');
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);

  if (!event.body) {
    const err = 'Trigger build does not have a body in event payload';
    consoleLogger.error('TriggerBuildError', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }

  if (!validateJsonWebhook(event, c.get<string>('githubSecret'))) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
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

  if (body.deleted) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Job Ignored (Deletion)',
    };
  }

  const env = c.get<string>('env');

  async function createAndInsertJob(path?: string) {
    const repoInfo = await docsetsRepository.getRepo(body.repository.name, path);
    const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
    const job = await prepGithubPushPayload(body, repoBranchesRepository, jobPrefix, repoInfo);

    consoleLogger.info(job.title, 'Creating Job');
    const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
    jobRepository.notify(jobId, c.get('jobUpdatesQueueUrl'), JobStatus.inQueue, 0);
    consoleLogger.info(job.title, `Created Job ${jobId}`);
  }

  if (process.env.FEATURE_FLAG_MONOREPO_PATH === 'true' && body.repository.name === MONOREPO_NAME) {
    let monorepoPaths: string[] = [];
    try {
      if (body.head_commit && body.repository.owner.name) {
        monorepoPaths = await getMonorepoPaths({
          commitSha: body.head_commit.id,
          repoName: body.repository.name,
          ownerName: body.repository.owner.name,
          updatedFilePaths: getUpdatedFilePaths(body.head_commit),
        });
        consoleLogger.info('monoRepoPaths', `Monorepo Paths with new changes: ${monorepoPaths}`);
      }
    } catch (error) {
      console.warn('Warning, attempting to get repo paths caused an error', error);
    }

    /* Create and insert Job for each monorepo project that has changes */
    for (const path of monorepoPaths) {
      // TODO: Deal with nested monorepo projects
      /* For now, we will ignore nested monorepo projects until necessary */
      if (path.split('/').length > 1) continue;

      try {
        await createAndInsertJob(`/${path}`);
      } catch (err) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'text/plain' },
          body: err,
        };
      }
    }

    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Jobs Queued',
    };
  }

  try {
    await createAndInsertJob();
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

export const MarkBuildArtifactsForDeletion = markBuildArtifactsForDeletion;
