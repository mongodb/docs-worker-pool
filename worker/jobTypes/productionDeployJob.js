
const GitHubJob = require('../jobTypes/githubJob').GitHubJobClass;
const S3Publish = require('../jobTypes/S3Publish').S3PublishClass;
const simpleGit = require('simple-git/promise');
const validator = require('validator');
const workerUtils = require('../utils/utils');
const buildTimeout = 60 * 450;
const uploadToS3Timeout = 20;

const invalidJobDef = new Error('job not valid');

async function verifyUserEntitlements(currentJob){
    const user = currentJob.user;
    const entitlementsObject = await workerUtils.getUserEntitlements(user);
    if (entitlementsObject && entitlementsObject.repos && entitlementsObject.repos.indexOf(`${repoOwner}/${repoName}`) !== -1) {
      return true;
    } else {
      return false;
    }
  }
  
  async function verifyBranchConfiguredForPublish(currentJob) {
    const repoObject = { repoOwner: currentJob.payload.repoOwner, repoName: currentJob.payload.repoName};
    const repoContent = await workerUtils.getRepoPublishedBranches(repoObject);
    const publishedBranches = repoContent['content']['git']['branches']['published']

    if (publishedBranches.includes(currentJob.payload.branchName)) {
      return true
    }
    
    return false
    
  }
//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(stringToCheck) {
  return (
    validator.isAscii(stringToCheck) &&
    validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
  );
}

function safeGithubProdPush(currentJob) {
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

async function startGithubBuild(job, logger) {
  const buildOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    job.buildRepo(logger),
    'Timed out on build'
  );
  // checkout output of build
  if (buildOutput && buildOutput.status === 'success') {
    // only post entire build output to slack if there are warnings
    const buildOutputToSlack = buildOutput.stdout + '\n\n' + buildOutput.stderr;
    if (buildOutputToSlack.indexOf('WARNING:') !== -1) {
      await logger.sendSlackMsg(buildOutputToSlack);
    }

    return new Promise(function(resolve, reject) {
      resolve(true);
    });
  }
}

async function pushToProduction(publisher, logger) {
  const prodOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    publisher.pushToProduction(logger),
    'Timed out on push to production'
  );
  // checkout output of build
  if (prodOutput && prodOutput.status === 'success') {
    await logger.sendSlackMsg(prodOutput.stdout);

    return new Promise(function(resolve, reject) {
      resolve(true);
    });
  }
}

async function runGithubProdPush(currentJob) {
  console.log("inside production deploy job")
  const ispublishable = verifyBranchConfiguredForPublish(currentJob);
  const userIsEntitled = verifyUserEntitlements(currentJob);

  if (ispublishable === false){
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)} You are trying to 
    
    to production a branch that is not configured for publishing`)
    throw new Error('entitlement failed');
    process.exit
  }
  if(userIsEntitled === false){
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)} failed, you are not entitled to build or deploy (${repoOwner}/${repoName}) for master branch`);
    throw new Error('entitlement failed');
    process.exit
  }

  workerUtils.logInMongo(currentJob, ' ** Running github push function');

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.repoName ||
    !currentJob.payload.branchName
  ) {
    workerUtils.logInMongo(currentJob,`${'(BUILD)'.padEnd(15)}failed due to insufficient definition`);
    throw invalidJobDef;
  }


  // TODO: create logging class somewhere else.. for now it's here
  const Logger = function(currentJob) {
    return {
      save: function(message) {
        workerUtils.logInMongo(currentJob, message);
      },
      sendSlackMsg: function(message) {
        workerUtils.populateCommunicationMessageInMongo(currentJob, message);
      },
    };
  };

  // instantiate github job class and logging class
  const job = new GitHubJob(currentJob);
  const logger = new Logger(currentJob);
  const publisher = new S3Publish(job);

  await startGithubBuild(job, logger);

  console.log('completed build');

  let branchext = '';
  let isMaster = true;

  if (currentJob.payload.branchName !== 'master') {
    branchext = '-' + currentJob.payload.branchName;
    isMaster = false;
  }

  if (isMaster) {
    console.log('pushing to prod')
    await pushToProduction(publisher, logger);
  } else {
    console.log('pushing to stage');
    await pushToStage(publisher, logger);
  }

  const files = workerUtils.getFilesInDir(
    './' + currentJob.payload.repoName + '/build/public' + branchext
  );

  return files;
}

module.exports = {
  runGithubProdPush,
  safeGithubProdPush,
};
