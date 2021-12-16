import c from "config";
import mongodb from "mongodb";
import { RepoEntitlementsRepository } from "../../../src/repositories/repoEntitlementsRepository";
import { BranchRepository } from "../../../src/repositories/branchRepository";
import { ConsoleLogger, ILogger } from "../../../src/services/logger";
import { SlackConnector } from "../../../src/services/slack"
import { JobRepository } from "../../../src/repositories/jobRepository";

function isUserEntitled(entitlementsObject: any): boolean {
  if (!entitlementsObject || !entitlementsObject.repos || entitlementsObject.repos.length <= 0) {
    return false
  }
  return true
}

function prepReponse(statusCode, contentType, body) {
  return {
    statusCode: statusCode,
    headers: { 'Content-Type': contentType },
    body: body
  };
}

async function buildEntitleBranchList(entitlement: any, branchRepository: BranchRepository) {
import {SlackConnector} from "../../../src/services/slack"
import { JobRepository } from "../../../src/repositories/jobRepository";

function isUserEntitled(entitlementsObject: any): boolean {
    if (!entitlementsObject || !entitlementsObject.repos || entitlementsObject.repos.length <= 0 ) {
        return false
    }
    return true
}

function prepReponse(statusCode, contentType, body) {
    return {
        statusCode: statusCode,
        headers: { 'Content-Type': contentType },
        body: body
    };
}

async function buildEntitleBranchList(entitlement:any, branchRepository: BranchRepository) {
  const branchPath = [];
  for (let i = 0; i < entitlement.repos.length; i++) {
    let pubBranches = [];
    const thisRepo = entitlement.repos[i];
    const [repoOwner, repoName] = thisRepo.split('/');
    const branches = await branchRepository.getRepoBranches(repoName)
    branches.forEach(branch => {
      branchPath.push(`${repoOwner}/${repoName}/${branch["name"]}`);
    });
    }); 
  }
  return branchPath;
}

function createPayload(jobType: string, repoOwner: string, repoName: string, branchName: string, newHead: string, aliased = false, alias = null, primaryAlias = false) {
  return {
    jobType,
    source: "github",
    action: "push",
    repoName,
    branchName,
    aliased,
    alias,
    isFork: true,
    private: (repoOwner === '10gen') ? true : false,
    isXlarge: true,
    repoOwner,
    url: 'https://github.com/' + repoOwner + '/' + repoName,
    newHead,
    primaryAlias
  };
}

function createJob(payload: any, jobTitle: string, jobUserName: string, jobUserEmail: string) {
  return {
    title: jobTitle,
    user: jobUserName,
    email: jobUserEmail,
    status: "inQueue",
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

export const DisplayRepoOptions = async (event: any = {}, context: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c)
  if (!slackConnector.validateSlackRequest(event)) {
    return prepReponse(401, 'text/plain', "Signature Mismatch, Authentication Failed!!");
  }
  let client = new mongodb.MongoClient(c.get("dbUrl"));
  await client.connect();
  const db = client.db(c.get("dbName"));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const parsed = JSON.parse(event.query.payload);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
  if (!isUserEntitled(entitlement)) {
    return prepReponse(401, 'text/plain', "User is not entitled!!");
  }
  const entitledBranches = await buildEntitleBranchList(entitlement, branchRepository);
  return slackConnector.displayRepoOptions(entitledBranches, event.query.trigger_id);
}

async function deployRepo(job: any, logger: ILogger, jobRepository: JobRepository) {
  try {
    await jobRepository.insertJob(job);
  } catch (err) {
    logger.error("SLACK:DEPLOYREPO", err);
  }
}

export const DeployRepo = async (event: any = {}, context: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c)
  if (!slackConnector.validateSlackRequest(event)) {
    return prepReponse(401, 'text/plain', "Signature Mismatch, Authentication Failed!!");
  }
  let client = new mongodb.MongoClient(c.get("dbUrl"));
  await client.connect();
  const db = client.db(c.get("dbName"));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const jobRepository = new JobRepository(db, c, consoleLogger);

  const parsed = JSON.parse(event.query.payload);
  const stateValues = parsed.view.state.values;

  const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
  if (!isUserEntitled(entitlement)) {
    return prepReponse(401, 'text/plain', "User is not entitled!!");
  }

  let values = slackConnector.parseSelection(stateValues);
  for (let i = 0; i < values.repo_option.length; i++) {
    // // e.g. mongodb/docs-realm/master => (site/repo/branch)
    const buildDetails = values.repo_option[i].value.split('/')
    const repoOwner = buildDetails[0]
    const repoName = buildDetails[1]
    const branchName = buildDetails[2]
    const hashOption = values.hash_option ? values.hash_option : null
    const jobTitle = 'Slack deploy: ' + entitlement.github_username;
    const jobUserName = entitlement.github_username;
    const jobUserEmail = entitlement.email ? entitlement.email : 'split@nothing.com';

    const branchObject = await branchRepository.getRepoBranchAliases(repoName, branchName);

    if (!branchObject || !branchObject.aliasObject) continue;

    const active = branchObject.aliasObject.active
    const publishOriginalBranchName = branchObject.aliasObject.publishOriginalBranchName
    const aliases = branchObject.aliasObject.aliases

    if (!active) {
      continue;
    }
    //This is for non aliased branch
    let newPayload = {}
    if (aliases === null) {
      const newPayload = createPayload("productionDeploy", repoOwner, repoName, branchName, hashOption, false, null)
      await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
    }
    //if this is stablebranch, we want autobuilder to know this is unaliased branch and therefore can reindex for search
    else {
      // we use the primary alias for indexing search, not the original branch name (ie 'master'), for aliased repos 
      if (publishOriginalBranchName && aliases) {
        newPayload = createPayload("productionDeploy", repoOwner, repoName, branchName, hashOption, true, null)
        await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
      }
      aliases.forEach(async function (alias, index) {
        const primaryAlias = (index === 0);
        const newPayload = createPayload("productionDeploy", repoOwner, repoName, branchName, hashOption, true, alias, primaryAlias)
        await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
      })
    }

  }
function createPayload(jobType:string, repoOwner:string, repoName:string, branchName:string, newHead:string, aliased=false, alias=null, primaryAlias=false) {
      return {
        jobType,
        source:     "github", 
        action:     "push", 
        repoName, 
        branchName,
        aliased,
        alias,
        isFork:     true, 
        private:    ( repoOwner === '10gen') ? true : false,
        isXlarge:   true,
        repoOwner,
        url:        'https://github.com/' + repoOwner + '/' + repoName,
        newHead, 
        primaryAlias
      }; 
}

function createJob(payload:any, jobTitle:string, jobUserName:string, jobUserEmail:string) {
    return {
        title: jobTitle,
        user: jobUserName, 
        email: jobUserEmail,
        status: "inQueue",
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

export const DisplayRepoOptions = async (event: any = {}, context: any = {}): Promise<any> => {
    const consoleLogger = new ConsoleLogger();
    const slackConnector = new SlackConnector(consoleLogger, c)
    if (!slackConnector.validateSlackRequest(event)) {
        return prepReponse(401, 'text/plain', "Signature Mismatch, Authentication Failed!!");
    }
    let client = new mongodb.MongoClient(c.get("dbUrl"));
    await client.connect();
    const db = client.db(c.get("dbName"));
    const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
    const branchRepository = new BranchRepository(db, c, consoleLogger);
    const parsed = JSON.parse(event.query.payload);
    const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
    if (!isUserEntitled(entitlement)) {
        return prepReponse(401, 'text/plain', "User is not entitled!!");
    }
    const entitledBranches = await buildEntitleBranchList(entitlement, branchRepository);
    return slackConnector.displayRepoOptions(entitledBranches,event.query.trigger_id);
}

async function deployRepo(job:any, logger: ILogger, jobRepository: JobRepository) {
    try {
        await jobRepository.insertJob(job);
    } catch (err) {
        logger.error("SLACK:DEPLOYREPO", err);
    }
}

export const DeployRepo = async (event: any = {}, context: any = {}): Promise<any> => {
    const consoleLogger = new ConsoleLogger();
    const slackConnector = new SlackConnector(consoleLogger, c)
    if (!slackConnector.validateSlackRequest(event)) {
        return prepReponse(401, 'text/plain', "Signature Mismatch, Authentication Failed!!");
    }
    let client = new mongodb.MongoClient(c.get("dbUrl"));
    await client.connect();
    const db = client.db(c.get("dbName"));
    const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
    const branchRepository = new BranchRepository(db, c, consoleLogger);
    const jobRepository = new JobRepository(db, c, consoleLogger);

    const parsed = JSON.parse(event.query.payload);
    const stateValues = parsed.view.state.values; 

    const entitlement = await repoEntitlementRepository.getRepoEntitlementsBySlackUserId(parsed.user.id);
    if (!isUserEntitled(entitlement)) {
        return prepReponse(401, 'text/plain', "User is not entitled!!");
    }

    let values = slackConnector.parseSelection(stateValues);
    for (let i = 0; i < values.repo_option.length; i++) {
        // // e.g. mongodb/docs-realm/master => (site/repo/branch)
        const buildDetails = values.repo_option[i].value.split('/')
        const repoOwner = buildDetails[0]
        const repoName = buildDetails[1]
        const branchName = buildDetails[2] 
        const hashOption =  values.hash_option ? values.hash_option : null
        const jobTitle     = 'Slack deploy: ' + entitlement.github_username;
        const jobUserName  = entitlement.github_username;
        const jobUserEmail = entitlement.email ? entitlement.email : 'split@nothing.com';
        
        const branchObject = await branchRepository.getRepoBranchAliases(repoName, branchName);
        
        if (!branchObject || !branchObject.aliasObject) continue;
        
        const active = branchObject.aliasObject.active
        const publishOriginalBranchName = branchObject.aliasObject.publishOriginalBranchName
        const aliases = branchObject.aliasObject.aliases
        
        if (!active) {
          continue;
        }
        //This is for non aliased branch
        let newPayload = {}
        if (aliases === null) {
          const newPayload = createPayload("productionDeploy", repoOwner, repoName, branchName,  hashOption, false, null)
          await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
        }
        //if this is stablebranch, we want autobuilder to know this is unaliased branch and therefore can reindex for search
        else {
              // we use the primary alias for indexing search, not the original branch name (ie 'master'), for aliased repos 
          if (publishOriginalBranchName && aliases) {
            newPayload = createPayload("productionDeploy", repoOwner, repoName, branchName,  hashOption, true, null)
            await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
          }
          aliases.forEach(async function(alias, index) {
            const primaryAlias = (index === 0); 
            const newPayload = createPayload("productionDeploy", repoOwner, repoName, branchName, hashOption, true, alias, primaryAlias)
            await deployRepo(createJob(newPayload, jobTitle, jobUserName, jobUserEmail), consoleLogger, jobRepository);
          })
        }

      }
    
}
