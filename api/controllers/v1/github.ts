import * as c from 'config';
import * as mongodb from 'mongodb';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { markBuildArtifactsForDeletion, validateJsonWebhook } from '../../handlers/github';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';
import { ReposBranchesDocsetsDocument } from '../../../modules/persistence/src/services/metadata/repos_branches';
import { PushEvent } from '@octokit/webhooks-types';
import { MONOREPO_NAME } from '../../../src/monorepo/utils/monorepo-constants';
import { getMonorepoPaths } from '../../../src/monorepo';
import { getUpdatedFilePaths } from '../../../src/monorepo/utils/path-utils';
import { JobStatus } from '../../../src/entities/job';

async function prepGithubPushPayload(
  githubEvent: any,
  repoBranchesRepository: RepoBranchesRepository,
  prefix: string,
  repoInfo: ReposBranchesDocsetsDocument,
  directory?: string
) {
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
      directory: directory,
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
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);

  if (!validateJsonWebhook(event, c.get<string>('githubSecret'))) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }
  if (!event.body) {
    const err = 'Trigger build does not have a body in event payload';
    consoleLogger.error('TriggerBuildError', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }

  let body: PushEvent;
  try {
    body = JSON.parse(event.body) as PushEvent;
  } catch (e) {
    console.log('[TriggerBuild]: ERROR! Could not parse event.body', e);
    console.log(`event: ${event} and event body: ${event.body}`);
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
    const job = await prepGithubPushPayload(body, repoBranchesRepository, jobPrefix, repoInfo, path);

    consoleLogger.info(job.title, 'Creating Job');
    const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
    jobRepository.notify(jobId, c.get('jobUpdatesQueueUrl'), JobStatus.inQueue, 0);
    consoleLogger.info(job.title, `Created Job ${jobId}`);
  }

  if (body.repository.name === MONOREPO_NAME) {
    // TODO: MONOREPO feature flag needed here
    consoleLogger.info(body.repository.full_name, `past feature flag and monorepo conditional`);
    let monorepoPaths: string[] = [];
    try {
      if (body.head_commit && body.repository.owner.name) {
        consoleLogger.info(
          body.repository.full_name,
          `commitSha: ${body.head_commit.id}\nrepoName: ${body.repository.name}\nownerName: ${
            body.repository.owner.name
          }\nUpdatedfilepaths: ${getUpdatedFilePaths(body.head_commit)}`
        );
        monorepoPaths = await getMonorepoPaths({
          commitSha: body.head_commit.id,
          repoName: body.repository.name,
          ownerName: body.repository.owner.name,
          updatedFilePaths: getUpdatedFilePaths(body.head_commit),
          consoleLogger,
        });
        consoleLogger.info(body.repository.full_name, `Monorepo Paths with new changes: ${monorepoPaths}`);
      }
    } catch (error) {
      console.warn('Warning, attempting to get repo paths caused an error', error);
    }

    /* Create and insert Job for each monorepo project that has changes */
    for (const path of monorepoPaths) {
      consoleLogger.info(body.repository.full_name, `Each path: ${path}`);
      // TODO: Deal with nested monorepo projects
      /* For now, we will ignore nested monorepo projects until necessary */
      if (path.split('/').length > 1) continue;

      try {
        await createAndInsertJob(path);
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

  // const repoInfo = await docsetsRepository.getRepo(body.repository.name);
  // const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
  // // TODO: Make job be of type Job
  // const job = await prepGithubPushPayload(body, repoBranchesRepository, jobPrefix, repoInfo);
  // try {
  //   consoleLogger.info(job.title, 'Creating Job');
  //   const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
  //   consoleLogger.info(job.title, `Created Job ${jobId}`);
  // } catch (err) {
  //   return {
  //     statusCode: 500,
  //     headers: { 'Content-Type': 'text/plain' },
  //     body: err,
  //   };
  // }
  // return {
  //   statusCode: 202,
  //   headers: { 'Content-Type': 'text/plain' },
  //   body: 'Job Queued',
  // };
};

export const MarkBuildArtifactsForDeletion = markBuildArtifactsForDeletion;
