import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { ConsoleLogger, ILogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { JobRepository } from '../../../src/repositories/jobRepository';
import {
  buildEntitledGroupsList,
  getQSString,
  isRestrictedToDeploy,
  isUserEntitled,
  prepResponse,
} from '../../handlers/slack';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';
import { Payload } from '../../../src/entities/job';
import { ProjectsRepository } from '../../../src/repositories/projectsRepository';
import { DOCS_METADATA } from '../../../src/constants';

export const DisplayRepoOptions = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);

  if (!slackConnector.validateSlackRequest(event)) {
    return prepResponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!');
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: 'Event body is undefined',
    };
  }

  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const projectsRepository = new ProjectsRepository(client.db(DOCS_METADATA), c, consoleLogger);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const key_val = getQSString(event.body);

  const isAdmin = await repoEntitlementRepository.getIsAdmin(key_val['user_id']);
  let entitledRepos: any[] = [];
  //if user has admin permissions, they can deploy all repo branches
  if (isAdmin) {
    const repos = await repoBranchesRepository.getProdDeployableRepoBranches();
    for (const repo of repos) {
      const projectEntry = await projectsRepository.getProjectEntry(repo.project);
      const repoOwner = projectEntry?.github?.organization;
      if (repoOwner) entitledRepos.push(`${repoOwner}/${repo.repoName}`);
    }
  } else {
    const entitlements = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(key_val['user_id']);
    if (!isUserEntitled(entitlements) || isRestrictedToDeploy(key_val['user_id'])) {
      const { restrictedProdDeploy } = c.get<any>('prodDeploy');
      const response = restrictedProdDeploy
        ? 'Production freeze in place - please notify DOP if seeing this past 3/26'
        : 'User is not entitled!';
      return prepResponse(401, 'text/plain', response);
    }
    entitledRepos = entitlements.repos;
  }

  const entitledBranches = await buildEntitledGroupsList(entitledRepos, repoBranchesRepository);
  const resp = await slackConnector.displayRepoOptions(entitledBranches, key_val['trigger_id'], isAdmin);
  if (resp?.status == 200 && resp?.data?.ok) {
    return {
      statusCode: 200,
      body: 'Model requested',
    };
  }
  return {
    statusCode: resp ? resp.status : 500,
    body: resp ? resp.data : 'Unknown error',
  };
};

async function deployRepo(deployable: Array<any>, logger: ILogger, jobRepository: JobRepository, jobQueueUrl) {
  try {
    await jobRepository.insertBulkJobs(deployable, jobQueueUrl);
  } catch (err) {
    console.error('Deploy repo error');
  }
}

// Used solely for adding parallel deploy jobs to another array
const deployHelper = (deployable, payload, jobTitle, jobUserName, jobUserEmail) => {
  deployable.push(createJob({ ...payload }, jobTitle, jobUserName, jobUserEmail));
};

// For every repo/branch selected to be deployed, return an array of jobs with the payload data
// needed for a successful build.
export const getDeployableJobs = async (
  values,
  entitlement,
  repoBranchesRepository: RepoBranchesRepository,
  docsetsRepository: DocsetsRepository
) => {
  const deployable = [];

  for (let i = 0; i < values?.repo_option?.length; i++) {
    let repoOwner: string, repoName: string, branchName: string, directory: string | undefined;
    const splitValues = values.repo_option[i].value.split('/');
    const jobTitle = `Slack deploy: ${values.repo_option[i].value}, by ${entitlement.github_username}`;
    if (splitValues.length === 3) {
      // e.g. mongodb/docs-realm/master => (owner/repo/branch)
      [repoOwner, repoName, branchName] = splitValues;
    } else if (splitValues.length === 4 && process.env.FEATURE_FLAG_MONOREPO_PATH === 'true') {
      // e.g. 10gen/docs-monorepo/cloud-docs/master => (owner/monorepo/repoDirectory/branch)
      [repoOwner, repoName, directory, branchName] = splitValues;
    } else {
      throw Error('Selected entitlement value is configured incorrectly. Check user entitlements!');
    }

    const hashOption = values?.hash_option ?? null;
    const jobUserName = entitlement.github_username;
    const jobUserEmail = entitlement?.email ?? '';

    const repoInfo = await docsetsRepository.getRepo(repoName, directory);
    const non_versioned = repoInfo.branches.length === 1;

    const branchObject = await repoBranchesRepository.getRepoBranchAliases(repoName, branchName, repoInfo.project);
    if (branchObject.status == 'failure' || !branchObject?.aliasObject)
      return prepResponse(401, 'text/plain', 'Branch not found in repos branches repository');

    const publishOriginalBranchName: boolean = branchObject.aliasObject.publishOriginalBranchName;
    const aliases: string[] | null = branchObject.aliasObject.urlAliases;
    let urlSlug: string = branchObject?.aliasObject.urlSlug; // string or null, string must match value in urlAliases or gitBranchName
    const isStableBranch = !!branchObject.aliasObject.isStableBranch; // bool or Falsey, add strong typing

    if (!urlSlug || !urlSlug.trim()) {
      urlSlug = branchName;
    }

    // Generic payload, will be conditionally modified appropriately
    const newPayload = createPayload(
      'productionDeploy',
      repoOwner,
      repoName,
      branchName,
      hashOption,
      repoInfo.project,
      repoInfo.prefix[c.get<string>('env')],
      urlSlug,
      false,
      false,
      isStableBranch,
      directory
    );

    if (!aliases || !aliases.length) {
      if (non_versioned) {
        newPayload.urlSlug = '';
      }
      deployHelper(deployable, newPayload, jobTitle, jobUserName, jobUserEmail);
      continue;
    }

    newPayload.aliased = true;

    // we use the primary alias for indexing search, not the original branch name (ie 'master'), for aliased repos
    if (urlSlug) {
      newPayload.urlSlug = urlSlug;
      newPayload.primaryAlias = true;
      deployHelper(deployable, newPayload, jobTitle, jobUserName, jobUserEmail);
    }

    // handle non-versioned repos AND repos where only 1 version is active
    if (non_versioned || (!publishOriginalBranchName && urlSlug === null)) {
      newPayload.urlSlug = '';
      deployHelper(deployable, newPayload, jobTitle, jobUserName, jobUserEmail);
    } else if (publishOriginalBranchName && urlSlug !== branchName) {
      newPayload.urlSlug = branchName;
      newPayload.primaryAlias = false;
      deployHelper(deployable, newPayload, jobTitle, jobUserName, jobUserEmail);
    }

    aliases.forEach(async (alias: string) => {
      if (alias !== urlSlug) {
        newPayload.stable = false;
        newPayload.urlSlug = alias;
        newPayload.primaryAlias = false;
        deployHelper(deployable, newPayload, jobTitle, jobUserName, jobUserEmail);
      }
    });
  }

  return deployable;
};

export const DeployRepo = async (event: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);
  if (!slackConnector.validateSlackRequest(event)) {
    return prepResponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!');
  }
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));

  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);
  const jobRepository = new JobRepository(db, c, consoleLogger);

  // This is coming in as urlencoded string, need to decode before parsing
  const decoded = decodeURIComponent(event.body).split('=')[1];
  const parsed = JSON.parse(decoded);
  const stateValues = parsed.view.state.values;

  //TODO: create an interface for slack view_submission payloads
  if (parsed.type !== 'view_submission') {
    return prepResponse(200, 'text/plain', 'Form not submitted, will not process request');
  }

  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
  if (!isUserEntitled(entitlement)) {
    return prepResponse(401, 'text/plain', 'User is not entitled!');
  }

  let values = [];
  const isAdmin = await repoEntitlementRepository.getIsAdmin(parsed.user.id);
  const optionGroups = parsed.view.blocks[0]?.element?.option_groups;
  try {
    values = await slackConnector.parseSelection(stateValues, isAdmin, optionGroups);
  } catch (e) {
    return prepResponse(401, 'text/plain', e);
  }
  let deployable;
  try {
    deployable = await getDeployableJobs(values, entitlement, repoBranchesRepository, docsetsRepository);
  } catch (e) {
    return prepResponse(401, 'text/plain', `${e} error within get deployable jobs`);
  }
  if (deployable.length > 0) {
    try {
      await deployRepo(deployable, consoleLogger, jobRepository, c.get('jobsQueueUrl'));
    } catch (e) {
      return prepResponse(401, 'text/plain', `${e} error deploying repos`);
    }
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
  };
};

function createPayload(
  jobType: string,
  repoOwner: string,
  repoName: string,
  branchName: string,
  newHead: string,
  project: string,
  prefix: string,
  urlSlug,
  aliased = false,
  primaryAlias = false,
  stable = false,
  directory?: string
) {
  return {
    jobType,
    source: 'github',
    action: 'push',
    repoName,
    branchName,
    project,
    prefix,
    aliased,
    urlSlug,
    isFork: true,
    isXlarge: true,
    repoOwner,
    url: 'https://github.com/' + repoOwner + '/' + repoName,
    newHead,
    primaryAlias,
    stable,
    directory,
  };
}

function createJob(payload: Payload, jobTitle: string, jobUserName: string, jobUserEmail: string) {
  return {
    title: jobTitle,
    user: jobUserName,
    email: jobUserEmail,
    status: 'inQueue',
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    buildDepsExeStartTime: 0,
    buildDepsExeEndTime: 0,
    parseExeStartTime: 0,
    parseExeEndTime: 0,
    htmlExeStartTime: 0,
    htmlExeEndTime: 0,
    oasPageBuildExeStartTime: 0,
    oasPageBuildExeEndTime: 0,
    error: {},
    result: null,
    payload: payload,
    logs: [],
  };
}
