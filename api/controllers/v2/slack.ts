import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { ConsoleLogger, ILogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { JobStatus } from '../../../src/entities/job';
import {
  buildEntitledBranchList,
  getQSString,
  isRestrictedToDeploy,
  isUserEntitled,
  prepResponse,
} from '../../handlers/slack';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';

export const DisplayRepoOptions = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);

  if (!event.body) {
    return {
      statusCode: 400,
      body: 'Event body is undefined',
    };
  }

  if (!slackConnector.validateSlackRequest(event)) {
    return prepResponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!');
  }
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const key_val = getQSString(event.body);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(key_val['user_id']);
  if (!isUserEntitled(entitlement) || isRestrictedToDeploy(key_val['user_id'])) {
    const { restrictedProdDeploy } = c.get<any>('prodDeploy');
    const response = restrictedProdDeploy
      ? 'Production freeze in place - please notify DOP if seeing this past 3/26'
      : 'User is not entitled!';
    return prepResponse(401, 'text/plain', response);
  }
  const entitledBranches = await buildEntitledBranchList(entitlement, repoBranchesRepository);
  const resp = await slackConnector.displayRepoOptions(entitledBranches, key_val['trigger_id']);
  if (resp?.status == 200 && resp?.data) {
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

    // we need to also notify the jobUpdatesQueue as well so that slack users get notified
    await Promise.all(
      deployable.map(async ({ jobId }) => {
        await jobRepository.notify(jobId, c.get('jobUpdatesQueueUrl'), JobStatus.inQueue, 0);
      })
    );
  } catch (err) {
    logger.error('deployRepo', err);
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

  for (let i = 0; i < values.repo_option.length; i++) {
    let repoOwner: string, repoName: string, branchName: string, directory: string | undefined;
    const splitValues = values.repo_option[i].value.split('/');

    if (process.env.FEATURE_FLAG_MONOREPO_PATH === 'true' && splitValues.length === 4) {
      // e.g. 10gen/docs-monorepo/cloud-docs/master => (owner/monorepo/repoDirectory/branch)
      [repoOwner, repoName, directory, branchName] = splitValues;
    } else {
      // e.g. mongodb/docs-realm/master => (owner/repo/branch)
      [repoOwner, repoName, branchName] = splitValues;
    }

    const hashOption = values?.hash_option ?? null;
    const jobTitle = `Slack deploy: ${values.repo_option[i].value}, by ${entitlement.github_username}`;
    const jobUserName = entitlement.github_username;
    const jobUserEmail = entitlement?.email ?? '';

    const repoInfo = await docsetsRepository.getRepo(repoName, directory);
    const non_versioned = repoInfo.branches.length === 1;

    const branchObject = await repoBranchesRepository.getRepoBranchAliases(repoName, branchName, repoInfo.project);
    if (!branchObject?.aliasObject) continue;

    const publishOriginalBranchName = branchObject.aliasObject.publishOriginalBranchName; //bool
    let aliases = branchObject.aliasObject.urlAliases; // array or null
    let urlSlug = branchObject.aliasObject.urlSlug; // string or null, string must match value in urlAliases or gitBranchName
    const isStableBranch = branchObject.aliasObject.isStableBranch; // bool or Falsey
    aliases = aliases?.filter((a) => a);
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
      false,
      directory
    );

    newPayload.stable = !!isStableBranch;

    if (!aliases || aliases.length === 0) {
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

    aliases.forEach((alias: string) => {
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

export const DeployRepo = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
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
  const db = client.db(c.get('dbName'));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);
  const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);
  const jobRepository = new JobRepository(db, c, consoleLogger);

  // This is coming in as urlencoded string, need to decode before parsing
  const decoded = decodeURIComponent(event.body).split('=')[1];
  const parsed = JSON.parse(decoded);
  const stateValues = parsed.view.state.values;

  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
  if (!isUserEntitled(entitlement)) {
    return prepResponse(401, 'text/plain', 'User is not entitled!');
  }

  const values = slackConnector.parseSelection(stateValues);

  const deployable = await getDeployableJobs(values, entitlement, repoBranchesRepository, docsetsRepository);
  if (deployable.length > 0) {
    await deployRepo(deployable, consoleLogger, jobRepository, c.get('jobsQueueUrl'));
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: 'success!',
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
    repoOwner,
    url: 'https://github.com/' + repoOwner + '/' + repoName,
    newHead,
    primaryAlias,
    stable,
    directory,
  };
}

function createJob(payload: any, jobTitle: string, jobUserName: string, jobUserEmail: string) {
  return {
    title: jobTitle,
    user: jobUserName,
    email: jobUserEmail,
    status: 'inQueue',
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
