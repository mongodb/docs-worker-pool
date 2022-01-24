import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { ConsoleLogger, ILogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';

function isUserEntitled(entitlementsObject: any): boolean {
  if (!entitlementsObject || !entitlementsObject.repos || entitlementsObject.repos.length <= 0) {
    return false;
  }
  return true;
}

function prepReponse(statusCode, contentType, body) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': contentType },
    body: body,
  };
}

async function buildEntitleBranchList(entitlement: any, branchRepository: BranchRepository) {
  const branchPath:string[] =[];
  for (let i = 0; i < entitlement.repos.length; i++) {
    const pubBranches = [];
    const thisRepo = entitlement.repos[i];
    const [repoOwner, repoName] = thisRepo.split('/');
    const branches = await branchRepository.getRepoBranches(repoName);
    if (branches) {
    branches.forEach((branch) => {
      let buildWithSnooty = true;
      if ('buildsWithSnooty' in branch ) {
        buildWithSnooty = branch['buildsWithSnooty']
      }
      if (buildWithSnooty ) {
        branchPath.push(`${repoOwner}/${repoName}/${branch['gitBranchName']}`);
      }
      
    });
  }
}
  return branchPath;
}

function getQSString(qs: string) {
  let key_val = {};
  const arr = qs.split("&");
  if (arr) {
    arr.forEach(keyval => {
    const kvpair = keyval.split("=")
    key_val[kvpair[0]] = kvpair[1]
  });
}
  return key_val;
}

export const DisplayRepoOptions = async (event: any = {}, context: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);
  if (!slackConnector.validateSlackRequest(event)) {
    return prepReponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!!');
  }
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const key_val = getQSString(event.body)
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(key_val["user_id"]);
  if (!isUserEntitled(entitlement)) {
    return prepReponse(401, 'text/plain', 'User is not entitled!!');
  }
  const entitledBranches = await buildEntitleBranchList(entitlement, branchRepository);
  console.log(entitledBranches)
  const resp = await slackConnector.displayRepoOptions(entitledBranches, key_val["trigger_id"]);
  if (resp && resp.status == 200 && resp.data) {
    return {
      'statusCode': 200,
      'body': "Model requested"
    }
  }
  return {
    'statusCode': resp ? resp.status : 500,
    'body': resp ? resp.data : "Unknown error"
  }
};

async function deployRepo(job: any, logger: ILogger, jobRepository: JobRepository) {
  try {
    await jobRepository.insertJob(job);
  } catch (err) {
    logger.error('SLACK:DEPLOYREPO', err);
  }
}

export const DeployRepo = async (event: any = {}, context: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c);
  if (!slackConnector.validateSlackRequest(event)) {
    return prepReponse(401, 'text/plain', 'Signature Mismatch, Authentication Failed!!');
  }
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const jobRepository = new JobRepository(db, c, consoleLogger);

  // This is coming in as urlencoded stirng, need to decode before parsing=

  let decoded = decodeURIComponent(event.body).split("=")[1];
  const parsed = JSON.parse(decoded);
  const stateValues = parsed.view.state.values;

  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
  if (!isUserEntitled(entitlement)) {
    return prepReponse(401, 'text/plain', 'User is not entitled!!');
  }

  const values = slackConnector.parseSelection(stateValues);
  for (let i = 0; i < values.repo_option.length; i++) {
    // // e.g. mongodb/docs-realm/master => (site/repo/branch)
    const buildDetails = values.repo_option[i].value.split('/');
    const repoOwner = buildDetails[0];
    const repoName = buildDetails[1];
    const branchName = buildDetails[2];
    const hashOption = values.hash_option ? values.hash_option : null;
    const jobTitle = 'Slack deploy: ' + entitlement.github_username;
    const jobUserName = entitlement.github_username;
    const jobUserEmail = entitlement.email ? entitlement.email : 'split@nothing.com';

    const repoInfo = await branchRepository.getRepo(repoName)
    const branchObject = await branchRepository.getRepoBranchAliases(repoName, branchName);

    if (!branchObject || !branchObject.aliasObject) continue;

    const active = branchObject.aliasObject.active //bool
    const publishOriginalBranchName = branchObject.aliasObject.publishOriginalBranchName //bool
    const aliases = branchObject.aliasObject.urlAliases //array or null
    const urlSlug = branchObject.aliasObject.urlSlug //string or null, string must match value in urlAliases or gitBranchName
    const isStableBranch = branchObject.aliasObject.isStableBranch // bool or Falsey

    if (!active) {
      continue;
    }
    //This is for non aliased branch
    let newPayload = {};
    if (aliases === null) {
      const newPayload = createPayload('productionDeploy', repoOwner, repoName, branchName, hashOption, repoInfo.project, repoInfo.prefix,false, null, false, '-g');
      await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
    }
    //if this is stablebranch, we want autobuilder to know this is unaliased branch and therefore can reindex for search
    else {
      let stable = ''
      if (isStableBranch) { stable = '-g' }
      // we use the primary alias for indexing search, not the original branch name (ie 'master'), for aliased repos
      if (urlSlug) { 
        newPayload = createPayload('productionDeploy', repoOwner, repoName, branchName, hashOption, repoInfo.project, repoInfo.prefix,true, urlSlug, true, stable);
        await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
      }
      if (publishOriginalBranchName) {
        newPayload = createPayload('productionDeploy', repoOwner, repoName, branchName, hashOption, repoInfo.project, repoInfo.prefix,true, null, true, stable);
        await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
      } else {
        return `ERROR: ${branchName} is misconfigured and cannot be deployed. Ensure that publishOriginalBranchName is set to true and/or specify a default urlSlug.`
      }
      aliases.forEach(async function (alias, index) {
        if (alias != urlSlug) {
          const primaryAlias = urlSlug === alias;
          const newPayload = createPayload(
            'productionDeploy',
            repoOwner,
            repoName,
            branchName,
            hashOption,
            repoInfo.project, 
            repoInfo.prefix,
            true,
            alias,
            primaryAlias,
          );
          await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
        }
      });
    }
  }
  return  {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' }
  };
}
function createPayload(
  jobType: string,
  repoOwner: string,
  repoName: string,
  branchName: string,
  newHead: string,
  project: string,
  prefix: string,
  aliased = false,
  urlSlug = null,
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
    private: repoOwner === '10gen' ? true : false,
    isXlarge: true,
    repoOwner,
    url: 'https://github.com/' + repoOwner + '/' + repoName,
    newHead,
    primaryAlias,
    stable
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

