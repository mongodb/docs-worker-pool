import * as c from 'config';
import * as mongodb from 'mongodb';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PushEvent, WorkflowRunCompletedEvent } from '@octokit/webhooks-types';

import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { ProjectsRepository } from '../../../src/repositories/projectsRepository';
import { EnhancedJob, EnhancedPayload, JobStatus } from '../../../src/entities/job';
import { markBuildArtifactsForDeletion, validateJsonWebhook } from '../../handlers/github';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';
import { getMonorepoPaths } from '../../../src/monorepo';
import { getUpdatedFilePaths } from '../../../src/monorepo/utils/path-utils';
import { ReposBranchesDocsetsDocument } from '../../../modules/persistence/src/services/metadata/repos_branches';
import { MONOREPO_NAME } from '../../../src/monorepo/utils/monorepo-constants';

const SMOKETEST_SITES = [
  'docs-landing',
  'cloud-docs',
  'docs-realm',
  'docs',
  'docs-atlas-cli',
  'docs-node',
  'docs-app-services',
];

//EnhancedPayload and EnhancedJob are used here for both githubPush (feature branch) events as well as productionDeploy(smoke test deploy) events for typing purposes
async function prepGithubPushPayload(
  githubEvent: PushEvent | WorkflowRunCompletedEvent,
  payload: EnhancedPayload,
  title: string
): Promise<Omit<EnhancedJob, '_id'>> {
  return {
    title: title,
    user: githubEvent.sender.login,
    status: JobStatus.inQueue,
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    payload,
    logs: [],
  };
}

interface CreatePayloadProps {
  repoName: string;
  isSmokeTestDeploy?: boolean;
  prefix: string;
  repoBranchesRepository: RepoBranchesRepository;
  repoInfo: ReposBranchesDocsetsDocument;
  newHead?: string;
  repoOwner?: string;
  directory?: string;
  githubEvent?: PushEvent;
}

async function createPayload({
  repoName,
  isSmokeTestDeploy = false,
  prefix,
  repoBranchesRepository,
  repoInfo,
  newHead,
  repoOwner = '',
  githubEvent,
  directory,
}: CreatePayloadProps): Promise<EnhancedPayload> {
  const source = 'github';
  const project = repoInfo?.project ?? repoName;

  let branchName: string;
  let jobType: string;
  let action: string;
  let url: string;

  if (isSmokeTestDeploy) {
    url = 'https://github.com/' + repoOwner + '/' + repoName;
    action = 'automatedTest';
    jobType = 'productionDeploy';
    branchName = 'master';
  } else {
    if (!githubEvent) {
      throw new Error(`Non SmokeTest Deploy jobs must have a github Event`);
    }
    action = 'push';
    jobType = 'githubPush';
    branchName = githubEvent.ref.split('/')[2];
    url = githubEvent.repository?.clone_url;
    newHead = githubEvent.after;
    repoOwner = githubEvent.repository?.owner?.login;
  }

  const branchInfo = await repoBranchesRepository.getRepoBranchAliases(repoName, branchName, repoInfo.project);
  const urlSlug = branchInfo.aliasObject?.urlSlug ?? branchName;

  return {
    jobType,
    source,
    action,
    repoName,
    repoOwner,
    branchName,
    project,
    prefix,
    urlSlug,
    url,
    newHead,
    directory,
  };
}

export const triggerSmokeTestAutomatedBuild = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult | null> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const projectsRepository = new ProjectsRepository(client.db(process.env.METADATA_DB_NAME), c, consoleLogger);
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

  let body: WorkflowRunCompletedEvent;
  try {
    body = JSON.parse(event.body) as WorkflowRunCompletedEvent;
  } catch (e) {
    console.log('[TriggerBuild]: ERROR! Could not parse event.body', e);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain' },
      body: ' ERROR! Could not parse event.body',
    };
  }

  if (body.workflow_run.conclusion != 'success')
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: `Build on branch ${body.workflow_run.head_branch} is not complete and will not trigger smoke test site deployments`,
    };

  if (body.workflow_run.name != 'Deploy Staging ECS')
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: `Workflow ${body.workflow_run.name} completed successfully but only Deploy Staging ECS workflow completion will trigger smoke test site deployments`,
    };

  // if the build was not building main branch, no need for smoke test sites
  // if (body.workflow_run.head_branch != 'main' || body.repository.fork) {
  //   console.log('Build was not on master branch in main repo, sites will not deploy as no smoke tests are needed');
  //   return {
  //     statusCode: 202,
  //     headers: { 'Content-Type': 'text/plain' },
  //     body: `Build on branch ${body.workflow_run.head_branch} will not trigger site deployments as it was not on main branch in upstream repo`,
  //   };
  // }

  //automated test builds will always deploy in dotcomstg
  const env = 'dotcomstg';

  async function createAndInsertJob() {
    return await Promise.all(
      SMOKETEST_SITES.map(async (repoName): Promise<string> => {
        const jobTitle = 'Smoke Test ' + repoName;
        let repoInfo, projectEntry, repoOwner;
        try {
          repoInfo = await docsetsRepository.getRepo(repoName);
          projectEntry = await projectsRepository.getProjectEntry(repoInfo.project);
          repoOwner = projectEntry.github.organization;
        } catch (err) {
          consoleLogger.error(
            `Atlas Repo Information Error`,
            `RepoInfo, projectEntry, or repoOwner not found for docs site ${repoName}. RepoInfo: ${repoInfo}, projectEntry: ${projectEntry}, repoOwner: ${repoOwner}`
          );
          return err;
        }

        const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
        const payload = await createPayload({
          repoName,
          isSmokeTestDeploy: true,
          prefix: jobPrefix,
          repoBranchesRepository,
          repoInfo,
          repoOwner,
        });

        //add logic for getting master branch, latest stable branch
        const job = await prepGithubPushPayload(body, payload, jobTitle);

        try {
          consoleLogger.info(job.title, 'Creating Job');
          const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
          jobRepository.notify(jobId, c.get('jobUpdatesQueueUrl'), JobStatus.inQueue, 0);
          consoleLogger.info(job.title, `Created Job ${jobId}`);
          return jobId;
        } catch (err) {
          consoleLogger.error('TriggerBuildError', `${err} Error inserting job for ${repoName}`);
          return err;
        }
      })
    );
  }

  try {
    const returnVal = await createAndInsertJob();
    // run tasks here

    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Smoke Test Jobs Queued with the following Job Ids ' + returnVal,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }
};

export const TriggerBuild = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);

  if (!event.body) {
    const err = 'Trigger build does not have a body in event payload';
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
    const repo = body.repository;
    const repoInfo = await docsetsRepository.getRepo(repo.name, path);
    const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
    const jobTitle = repo.full_name;
    const payload = await createPayload({
      repoName: repo.name,
      prefix: jobPrefix,
      repoBranchesRepository,
      repoInfo,
      githubEvent: body,
    });

    const job = await prepGithubPushPayload(body, payload, jobTitle);

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
        consoleLogger.info(body.repository.full_name, `Monorepo Paths with new changes: ${monorepoPaths}`);
      }
    } catch (error) {
      consoleLogger.warn('Warning, attempting to get monorepo paths caused an error', error);
    }

    /* Create and insert Job for each monorepo project that has changes */
    for (const path of monorepoPaths) {
      consoleLogger.info(body.repository.full_name, `Create Job for Monorepo directory: /${path}`);
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
};

export const MarkBuildArtifactsForDeletion = markBuildArtifactsForDeletion;
