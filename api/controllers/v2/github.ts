import * as c from 'config';
import * as mongodb from 'mongodb';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PushEvent, WorkflowRunCompletedEvent } from '@octokit/webhooks-types';

import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { ProjectsRepository } from '../../../src/repositories/projectsRepository';
import { EnhancedJob, JobStatus } from '../../../src/entities/job';
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

async function prepGithubPushPayload(
  githubEvent: PushEvent | WorkflowRunCompletedEvent,
  payload: any,
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
    payload: payload,
    logs: [],
  };
}

async function createPayload(
  repoName: string,
  isSmokeTestDeploy = false,
  prefix: string,
  repoBranchesRepository: RepoBranchesRepository,
  repoInfo: ReposBranchesDocsetsDocument,
  newHead: string,
  repoOwner?: string,
  githubEvent?: PushEvent,
  directory?: string
) {
  const jobType = 'githubPush';
  const source = 'github';
  const project = repoInfo?.project ?? repoName;

  let branchName: string;
  let action: string;
  let url: any;
  let isFork: boolean;

  if (isSmokeTestDeploy) {
    url = 'https://github.com/' + repoOwner + '/' + repoName;
    branchName = 'master';
    isFork = false;
    action = 'automatedTest';
  } else {
    if (!githubEvent) {
      return false;
    }
    action = 'push';
    branchName = githubEvent.ref.split('/')[2];
    isFork = githubEvent?.repository.fork;
    url = githubEvent?.repository.clone_url;
    newHead = githubEvent?.after;
    repoOwner = githubEvent.repository.owner.login;
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
    isFork,
    url,
    newHead,
    directory,
  };
}

/**
 * 1st, we want to define a list of the sites we want to build as a new collection.
 * validate credentials
 * Next, we want to create each job
 *  - should I create a new prepGithubPayload method, a new githubEvent interface, or amend the existing one to be able to pass in a different title, branchName and it's own githash
 *  - i could also alter body attributes, although I don't know it that's a good idea
 *  - could also create a createpayload function
 * create and insert the jobs using bulk insert
 */
export const triggerSmokeTestAutomatedBuild = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult | null> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  //add docs_metadata to config
  const projectsRepository = new ProjectsRepository(client.db('docs_metadata'), c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);

  if (!event.body) {
    const err = 'Trigger build does not have a body in event payload';
    consoleLogger.error('TriggerBuildError', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }

  // validate credentials here
  if (!validateJsonWebhook(event, 'mongodbsmoketesting')) {
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
      body:
        'Build on branch ' +
        body.workflow_run.head_branch +
        ' is not complete and will not trigger smoke test site deployments ',
    };

  if (body.workflow_run.name != 'Deploy Staging ECS')
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body:
        'Workflow ' +
        body.workflow_run.name +
        ' completed successfully but only Deploy Staging ECS workflow completion will trigger smoke test site deployments',
    };

  //if the build was not building master, no need for smoke test sites
  // if (body.workflow_run.head_branch != 'main' || body.repository.fork) {
  //   console.log('Build was not on master branch in main repo, sites will not deploy as no smoke tests are needed');
  //   return {
  //     statusCode: 202,
  //     headers: { 'Content-Type': 'text/plain' },
  //     body:
  //       'Build on branch' +
  //       body.workflow_run.head_branch +
  //       ' will not trigger site deployments as it was not on master branch in upstream repo',
  //   };
  // }

  //automated test builds will always deploy in dotcomstg
  const env = 'dotcomstg';

  async function createAndInsertJob() {
    let names = '';
    for (const s in SMOKETEST_SITES) {
      names = names + s;
      const repoName = SMOKETEST_SITES[s];
      const jobTitle = 'Smoke Test ' + repoName;
      let repoInfo, projectEntry, repoOwner;
      const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);
      // if (repoName == 'docs') return docsetsRepository.getRepo(repoName);

      try {
        repoInfo = await docsetsRepository.getRepo(repoName);
        projectEntry = await projectsRepository.getProjectEntry(repoInfo.project);
        repoOwner = projectEntry.github.organization;
      } catch {
        return (
          'repoInfo, projectEntry, or repoOwner not found.  Repo info: ' +
          repoInfo.project +
          'projectEntry ' +
          projectEntry +
          ' repoOwner ' +
          repoOwner
        );
      }

      const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
      //add commit hash to jobPrefix here?
      //const newHead = body.workflow_run.head_sha;

      const payload = await createPayload(repoName, true, jobPrefix, repoBranchesRepository, repoInfo, '', repoOwner);
      //add logic for getting master branch, latest stable branch
      const job = await prepGithubPushPayload(body, payload, jobTitle);

      try {
        consoleLogger.info(job.title, 'Creating Job');
        const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
        // jobRepository.notify(jobId, c.get('jobUpdatesQueueUrl'), JobStatus.inQueue, 0);
        consoleLogger.info(job.title, `Created Job ${jobId}`);
      } catch (err) {
        return err + repoName;
        consoleLogger.error('TriggerBuildError', err + repoName);
      }
      // deployable.push(job);
    }
    return names;

    // try {
    //   await jobRepository.insertBulkJobs(deployable, c.get('jobsQueueUrl'));
    //   // notify the jobUpdatesQueue
    //   await Promise.all(
    //     deployable.map(async ({ jobId }) => {
    //       await jobRepository.notify(jobId, c.get('jobUpdatesQueueUrl'), JobStatus.inQueue, 0);
    //       consoleLogger.info(jobId, `Created Job ${jobId}`);
    //     })
    //   );
    // } catch (err) {
    //   consoleLogger.error('TriggerBuildError', err+ );
    // }
  }

  let returnVal;
  try {
    returnVal = await createAndInsertJob();
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: returnVal + err,
    };
  }
  return {
    statusCode: 202,
    headers: { 'Content-Type': 'text/plain' },
    body: 'Jobs Queued ' + returnVal,
  };
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
    const repo = body.repository;
    const repoInfo = await docsetsRepository.getRepo(repo.name, path);
    const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
    const jobTitle = repo.full_name;

    const payload = createPayload(repo.name, false, jobPrefix, repoBranchesRepository, repoInfo, undefined, body);
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
      body: 'Jobs Queued ',
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
