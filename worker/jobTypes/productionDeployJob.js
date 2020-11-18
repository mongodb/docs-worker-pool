const validator = require('validator');
const workerUtils = require('../utils/utils');
const GitHubJob = require('../jobTypes/githubJob').GitHubJobClass;
const S3Publish = require('../jobTypes/S3Publish').S3PublishClass;
const GatsbyAdapter = require('../jobTypes/GatsbyAdapter').GatsbyAdapterClass;
const Logger = require('../utils/logger').LoggerClass;

const buildTimeout = 60 * 450;
const invalidJobDef = new Error('job not valid');

async function verifyUserEntitlements (currentJob) {
  const user = currentJob.user;
  const entitlementsObject = await workerUtils.getUserEntitlements(user);
  const repoOwner = currentJob.payload.repoOwner;
  const repoName = currentJob.payload.repoName;

  if (entitlementsObject && entitlementsObject.repos && entitlementsObject.repos.indexOf(`${repoOwner}/${repoName}`) !== -1) {
    return true;
  }
  return false;
}

async function verifyBranchConfiguredForPublish (currentJob) {
  const repoObject = {
    repoOwner: currentJob.payload.repoOwner, repoName: currentJob.payload.repoName
  };
  const repoContent = await workerUtils.getRepoPublishedBranches(repoObject);
  if (repoContent && repoContent.status === 'success') {
    const publishedBranches = repoContent.content.git.branches.published;
    console.log(repoContent.content.version["stable"], repoContent.content.version.stable, )
    //if primary alias, check if this is stable branch
    if (currentJob.payload.primaryAlias) {
      console.log(repoContent.content.version.stable === currentJob.payload.branchName ? '-g' : '')
      currentJob.payload["stableBranch"] = repoContent.content.version.stable === currentJob.payload.branchName ? '-g' : '';
    }
    
    return publishedBranches.includes(currentJob.payload.branchName);
  }

  return false;
}

// anything that is passed to an exec must be validated or sanitized
// we use the term sanitize here lightly -- in this instance this // ////validates
function safeString (stringToCheck) {
  return (
    validator.isAscii(stringToCheck) &&
    validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
  );
}

function safeGithubProdPush (currentJob) {
  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.repoName ||
    !currentJob.payload.repoOwner ||
    !currentJob.payload.branchName
  ) {
    workerUtils.logInMongo(
      currentJob,
      `${'    (sanitize)'.padEnd(15)}failed due to insufficient job definition`
    );
    throw invalidJobDef;
  }

  if (
    safeString(currentJob.payload.repoName) &&
    safeString(currentJob.payload.repoOwner) &&
    safeString(currentJob.payload.branchName)
  ) {
    return true;
  }
  throw invalidJobDef;
}

async function startGithubBuild (job, logger) {
  const builder = new GatsbyAdapter(job);
  const buildOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    job.buildRepo(logger, builder, true),
    'Timed out on build'
  );
    // checkout output of build
  if (buildOutput && buildOutput.status === 'success') {
    // only post entire build output to slack if there are warnings
    const buildOutputToSlack = `${buildOutput.stdout}\n\n${buildOutput.stderr}`;
    logger.filterOutputForUserLogs(buildOutputToSlack, job);
    return new Promise((resolve) => {
      resolve(true);
    });
  }

  return new Promise((resolve, reject) => {
    reject(false);
  });
}

async function pushToProduction (publisher, logger) {
  const prodOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    publisher.pushToProduction(logger),
    'Timed out on push to production'
  );
  // checkout output of build
  if (prodOutput && prodOutput.status === 'success') {
    await logger.sendSlackMsg(prodOutput.stdout);

    return new Promise((resolve) => {
      resolve(true);
    });
  }
  return new Promise((resolve, reject) => {
    reject(false);
  });
}

async function runGithubProdPush (currentJob) {
  const ispublishable = await verifyBranchConfiguredForPublish(currentJob);
  const userIsEntitled = await verifyUserEntitlements(currentJob);

  if (!ispublishable) {
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)} You are trying to run in production a branch that is not configured for publishing`)
    throw new Error('entitlement failed');
  }
  if (!userIsEntitled) {
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)} failed, you are not entitled to build or deploy (${currentJob.payload.repoOwner}/${currentJob.payload.repoName}) for ${currentJob.payload.branchName} branch`);
    throw new Error('entitlement failed');
  }

  workerUtils.logInMongo(currentJob, ' ** Running github push function');

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.repoName ||
    !currentJob.payload.branchName
  ) {
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)}failed due to insufficient definition`);
    throw invalidJobDef;
  }

  // instantiate github job class and logging class
  const job = new GitHubJob(currentJob);
  const logger = new Logger(currentJob);
  const publisher = new S3Publish(job);

  await startGithubBuild(job, logger);

  await pushToProduction(publisher, logger);

  const files = workerUtils.getFilesInDir(
    `./${currentJob.payload.repoName}/build/public`
  );

  return files;
}

module.exports = {
  startGithubBuild,
  runGithubProdPush,
  safeGithubProdPush,
  verifyBranchConfiguredForPublish,
  verifyUserEntitlements,
  pushToProduction
};
