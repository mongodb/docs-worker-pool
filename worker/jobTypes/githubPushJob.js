//const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const GitHubJob = require('../jobTypes/githubJob').GitHubJobClass;
const S3Publish = require('../jobTypes/S3Publish').S3PublishClass;
const validator = require('validator');
const Logger = require('../utils/logger').LoggerClass;

const buildTimeout = 60 * 450;

const invalidJobDef = new Error('job not valid');

function safeBranch(currentJob){
  if (currentJob.payload.upstream) {
    return currentJob.payload.upstream === currentJob.payload.branchName;
  }

  // master branch cannot run through github push, unless upstream for server docs repo
  if (currentJob.payload.branchName === 'master') {
    workerUtils.logInMongo(
      currentJob,
      `${'(BUILD)'.padEnd(
        15
      )} failed, master branch not supported on staging builds`
    );
    throw new Error('master branches not supported');
    return false;
  }

  return true;
}

//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(safeString) {
  return (
    validator.isAscii(stringToCheck) &&
    validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
  );
}

function safeGithubPush(currentJob) {
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
    // safeString(currentJob.payload.branchName)
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
      reject(false);
    });
  }
}

async function pushToStage(publisher, logger) {
  const stageOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    publisher.pushToStage(logger),
    'Timed out on push to stage'
  );
  // checkout output of build
  if (stageOutput && stageOutput.status === 'success') {
    await logger.sendSlackMsg(stageOutput.stdout);

    return new Promise(function(resolve, reject) {
      resolve(true);
      reject(false);
    });
  }
}

async function runGithubPush(currentJob) {
  workerUtils.logInMongo(currentJob, ' ** Running github push function');

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.repoName ||
    !currentJob.payload.branchName
  ) {
    workerUtils.logInMongo(
      currentJob,
      `${'(BUILD)'.padEnd(15)}failed due to insufficient definition`
    );
    throw invalidJobDef;
  }


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


  console.log('pushing to stage');
  await pushToStage(publisher, logger);


  const files = workerUtils.getFilesInDir(
    './' + currentJob.payload.repoName + '/build/public' + branchext
  );

  return files;
}

module.exports = {
  runGithubPush,
  safeGithubPush
};
