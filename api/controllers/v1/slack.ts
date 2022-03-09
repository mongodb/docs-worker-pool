import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { ConsoleLogger, ILogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';

function isUserEntitled(entitlementsObject: any): boolean {
  return (entitlementsObject?.repos?.length ?? 0) > 0;
}

function prepReponse(statusCode, contentType, body) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': contentType },
    body: body,
  };
}

async function buildEntitledBranchList(entitlement: any, branchRepository: BranchRepository) {
  const entitledBranches: string[] = [];
  for (const repo of entitlement.repos) {
    const [repoOwner, repoName] = repo.split('/');
    const branches = await branchRepository.getRepoBranches(repoName);
    for (const branch of branches) {
      let buildWithSnooty = true;
      if ('buildsWithSnooty' in branch) {
        buildWithSnooty = branch['buildsWithSnooty'];
      }
      if (buildWithSnooty) {
        entitledBranches.push(`${repoOwner}/${repoName}/${branch['gitBranchName']}`);
      }
    }
  }
  return entitledBranches;
}

function getQSString(qs: string) {
  const key_val = {};
  const arr = qs.split('&');
  if (arr) {
    arr.forEach((keyval) => {
      const kvpair = keyval.split('=');
      key_val[kvpair[0]] = kvpair[1];
    });
  }
  return key_val;
}

export const DisplayRepoOptions = async (event: any = {}, context: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);
  if (!slackConnector.validateSlackRequest(event)) {
    return prepReponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!');
  }
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const key_val = getQSString(event.body);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(key_val['user_id']);
  if (!isUserEntitled(entitlement)) {
    return prepReponse(401, 'text/plain', 'User is not entitled!');
  }
  const entitledBranches = await buildEntitledBranchList(entitlement, branchRepository);
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

async function deployRepo(
  deployable: Array<any>,
  logger: ILogger,
  jobRepository: JobRepository,
  parallelJobRepo: JobRepository,
  parellelUrl: string,
  parallelPrefix: string
) {
  try {
    await jobRepository.insertJBulkJobs(deployable, c.get('jobsQueueUrl'));
    if (parallelJobRepo) {
      deployable.map((job) => {
        job.payload.prefix = parallelPrefix;
      });
      await parallelJobRepo.insertJBulkJobs(deployable, parellelUrl);
    }
  } catch (err) {
    logger.error('deployRepo', err);
  }
}

export const DeployRepo = async (event: any = {}, context: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);
  if (!slackConnector.validateSlackRequest(event)) {
    return prepReponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!');
  }
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const jobRepository = new JobRepository(db, c, consoleLogger);
  let parallelJobRepo = null;
  let parallelUrl = '';
  let parallelPrefix = '';
  const parallel = c.get<any>('parallel');
  const env = c.get<string>('env');
  const depolayable = [];
  // This is coming in as urlencoded stirng, need to decode before parsing=

  const decoded = decodeURIComponent(event.body).split('=')[1];
  const parsed = JSON.parse(decoded);
  const stateValues = parsed.view.state.values;

  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
  if (!isUserEntitled(entitlement)) {
    return prepReponse(401, 'text/plain', 'User is not entitled!');
  }

  if (parallel && parallel['enabled'] && parallel[env]) {
    parallelJobRepo = new JobRepository(db, c, consoleLogger, parallel[env]['jobQueueCollection']);
    parallelUrl = parallel[env]['jobsQueueUrl'];
  }
  const values = slackConnector.parseSelection(stateValues);
  let jobCount = 0;
  for (let i = 0; i < values.repo_option.length; i++) {
    // // e.g. mongodb/docs-realm/master => (site/repo/branch)
    const [repoOwner, repoName, branchName] = values.repo_option[i].value.split('/');
    const hashOption = values?.hash_option ?? null;
    const jobTitle = 'Slack deploy: ' + entitlement.github_username;
    const jobUserName = entitlement.github_username;
    const jobUserEmail = entitlement?.email ?? '';

    const repoInfo = await branchRepository.getRepo(repoName);
    const non_versioned = repoInfo.branches.length === 1 ? true : false;
    if (parallelJobRepo) {
      parallelPrefix = repoInfo.prefix[parallel[env]['parallelStgName']];
    }
    const branchObject = await branchRepository.getRepoBranchAliases(repoName, branchName);
    if (!branchObject?.aliasObject) continue;

    const active = branchObject.aliasObject.active; //bool
    const publishOriginalBranchName = branchObject.aliasObject.publishOriginalBranchName; //bool
    let aliases = branchObject.aliasObject.urlAliases; //array or null
    let urlSlug = branchObject.aliasObject.urlSlug; //string or null, string must match value in urlAliases or gitBranchName
    const isStableBranch = branchObject.aliasObject.isStableBranch; // bool or Falsey
    aliases = aliases?.filter((a) => a);
    if (!urlSlug && non_versioned == false) {
      urlSlug = branchName;
    }

    if (!active) {
      continue;
    }
    //Generic payload, will be conditionaly modified appropriately
    const newPayload = createPayload(
      'productionDeploy',
      repoOwner,
      repoName,
      branchName,
      hashOption,
      repoInfo.project,
      repoInfo.prefix[c.get<string>('env')],
      non_versioned ? '' : branchName,
      false,
      false,
      '-g'
    );
    if (!aliases) {
      depolayable.push(createJob(Object.assign({}, newPayload), jobTitle, jobUserName, jobUserEmail));
      jobCount += 1;
    }
    //if this is stablebranch, we want autobuilder to know this is unaliased branch and therefore can reindex for search
    else {
      let stable = '';
      if (isStableBranch) {
        stable = '-g';
      }

      newPayload.stable = stable;
      newPayload.aliased = true;
      newPayload.primaryAlias = true;

      // we use the primary alias for indexing search, not the original branch name (ie 'master'), for aliased repos
      if (urlSlug) {
        newPayload.urlSlug = urlSlug;
        depolayable.push(createJob(Object.assign({}, newPayload), jobTitle, jobUserName, jobUserEmail));
        jobCount += 1;
      }
      if (non_versioned) {
        newPayload.urlSlug = '';
        depolayable.push(createJob(Object.assign({}, newPayload), jobTitle, jobUserName, jobUserEmail));
        jobCount += 1;
      } else if (publishOriginalBranchName) {
        newPayload.urlSlug = branchName;
        depolayable.push(createJob(Object.assign({}, newPayload), jobTitle, jobUserName, jobUserEmail));
        jobCount += 1;
      }
      aliases.forEach(async (alias) => {
        if (alias != urlSlug) {
          const primaryAlias = urlSlug === alias;
          newPayload.stable = '';
          newPayload.urlSlug = alias;
          newPayload.primaryAlias = primaryAlias;
          depolayable.push(createJob(Object.assign({}, newPayload), jobTitle, jobUserName, jobUserEmail));
          jobCount += 1;
        }
      });
    }
  }

  if (depolayable.length > 0) {
    await deployRepo(depolayable, consoleLogger, jobRepository, parallelJobRepo, parallelUrl, parallelPrefix);
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
  stable = ''
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
    private: repoOwner === '10gen',
    isXlarge: true,
    repoOwner,
    url: 'https://github.com/' + repoOwner + '/' + repoName,
    newHead,
    primaryAlias,
    stable,
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
