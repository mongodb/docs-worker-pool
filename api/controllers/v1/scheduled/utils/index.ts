import * as c from 'config';
import * as mongodb from 'mongodb';
import { BranchRepository } from '../../../../../src/repositories/branchRepository';
import { ConsoleLogger, ILogger } from '../../../../../src/services/logger';
import { JobRepository } from '../../../../../src/repositories/jobRepository';
// Used solely for adding parallel deploy jobs to another array
const deployHelper = (deployable, payload, jobTitle, jobUserName) => {
    deployable.push(createJob({ ...payload }, jobTitle, jobUserName));
};

function createJob(payload: any, jobTitle: string, jobUserName: string) {
    return {
        title: jobTitle,
        user: jobUserName,
        email: '',
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
// For every repo/branch selected to be deployed, return an array of jobs with the payload data
// needed for a successful build.
const getDeployableJobs = async (repoOwner:string , repoName:string , branchName: string, branchRepository: BranchRepository) => {
    const deployable = [];
    const hashOption = null;
    const jobUserName = 'scheduled_deploy';
    const jobTitle = `Scheduled Deploy Action`

    const repoInfo = await branchRepository.getRepo(repoName);
    const non_versioned = repoInfo.branches.length === 1;

    const branchObject = await branchRepository.getRepoBranchAliases(repoName, branchName);
    if (!branchObject?.aliasObject) return;

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
    '-g'
    );

    if (!aliases || aliases.length === 0) {
        if (non_versioned) {
            newPayload.urlSlug = '';
        }
        deployHelper(deployable, newPayload, jobTitle, jobUserName);
        return;
    }

    // if this is stable branch, we want autobuilder to know this is unaliased branch and therefore can reindex for search
    newPayload.stable = isStableBranch ? '-g' : '';
    newPayload.aliased = true;

    // we use the primary alias for indexing search, not the original branch name (ie 'master'), for aliased repos
    if (urlSlug) {
        newPayload.urlSlug = urlSlug;
        newPayload.primaryAlias = true;
        deployHelper(deployable, newPayload, jobTitle, jobUserName);
    }

    // handle non-versioned repos AND repos where only 1 version is active
    if (non_versioned || (!publishOriginalBranchName && urlSlug === null)) {
        newPayload.urlSlug = '';
        deployHelper(deployable, newPayload, jobTitle, jobUserName);
    } else if (publishOriginalBranchName && urlSlug !== branchName) {
        newPayload.urlSlug = branchName;
        newPayload.primaryAlias = false;
        deployHelper(deployable, newPayload, jobTitle, jobUserName);
    }

    aliases.forEach(async (alias: string) => {
    if (alias !== urlSlug) {
        newPayload.stable = '';
        newPayload.urlSlug = alias;
        newPayload.primaryAlias = false;
        deployHelper(deployable, newPayload, jobTitle, jobUserName);
    }
    });

    return deployable;
  };

async function deployRepo(deployable: Array<any>, logger: ILogger, jobRepository: JobRepository, jobQueueUrl) {
    try {
        return jobRepository.insertBulkJobs(deployable, jobQueueUrl);
    } catch (err) {
        logger.error('deployRepo', err);
    }
}

export const DeployRepo = async (repoOwner, repoName, branchName): Promise<any> => {
    const consoleLogger = new ConsoleLogger();
    const client = new mongodb.MongoClient(c.get('dbUrl'));
    await client.connect();
    const db = client.db(c.get('dbName'));
    const branchRepository = new BranchRepository(db, c, consoleLogger);
    const jobRepository = new JobRepository(db, c, consoleLogger);
    
    const deployable = await getDeployableJobs(repoOwner, repoName, branchName, branchRepository);
    if (deployable.length > 0) {
      return deployRepo(deployable, consoleLogger, jobRepository, c.get('jobsQueueUrl'));
    }
  };