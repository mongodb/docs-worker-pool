/*
 *  this is the github-triggered processor for builds
 *  it expects a worker.sh in the root of the repository
 *  an example job definition lives in jobDef.json
 */

const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const GitHubJob = require('../jobTypes/githubJob').GitHubJob;
const simpleGit = require('simple-git/promise');
const validator = require('validator');

const buildTimeout = 60 * 450;
const uploadToS3Timeout = 20;

const invalidJobDef = new Error('job not valid');

//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(stringToCheck) {
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
    safeString(currentJob.payload.branchName)
  ) {
    return true;
  }
  throw invalidJobDef;
}

async function startGithubBuild(job, logger) {
  // cleanup the repo directory
  await workerUtils.promiseTimeoutS(
    buildTimeout,
    cleanup(job, logger),
    'Timed out on rm'
  );

  // clone the repo
  await workerUtils.promiseTimeoutS(
    buildTimeout,
    cloneRepo(job, logger),
    'Timed out on clone repo'
  );

  // execute the build
  await workerUtils.promiseTimeoutS(
    buildTimeout,
    buildRepo(job, logger),
    'Timed out on build'
  );
}

async function cleanup(currentJob, logger) {
  logger.save(`${'(rm)'.padEnd(15)}Cleaning up repository`);
  const cleaning = await currentJob.cleanup(logger);
  logger.save(`${'(rm)'.padEnd(15)}Finished cleaning repo`);
}

async function cloneRepo(currentJob, logger) {
  logger.save(`${'(GIT)'.padEnd(15)}Cloning repository`);
  logger.save(`${'(GIT)'.padEnd(15)}running fetch`);
  const cloning = await currentJob.cloneRepo(logger);
  logger.save(`${'(GIT)'.padEnd(15)}Finished git clone`);
}

async function buildRepo(currentJob, logger) {
  logger.save(`${'(BUILD)'.padEnd(15)}Running Build`);
  logger.save(`${'(BUILD)'.padEnd(15)}running worker.sh`);
  const building = await currentJob.buildRepo(logger);

  if (building && building.status === 'success') {
    logger.save(`${'(BUILD)'.padEnd(15)}worker.sh run details:\n\n${building.stdout}\n---\n${building.stderr}`);

    // only post entire build output to slack if there are warnings
    const buildOutputToSlack = building.stdout + '\n\n' + building.stderr;
    if (buildOutputToSlack.indexOf('WARNING:') !== -1) {
      workerUtils.populateCommunicationMessageInMongo(currentJob, buildOutputToSlack);
    }

    console.log('finished build');
    logger.save(`${'(BUILD)'.padEnd(15)}Finished Build`);
  }
}

async function pushToStage(currentJob) {
  workerUtils.logInMongo(
    currentJob,
    `${'    (stage)'.padEnd(15)}Pushing to staging`
  );
  // change working dir to the repo we need to build
  try {
    const exec = workerUtils.getExecPromise();
    const command = `. /venv/bin/activate; cd repos/${workerUtils.getRepoDirName(currentJob)}; make stage;`;
    const { stdout, stderr } = await exec(command);
    let stdoutMod = '';
    // get only last part of message which includes # of files changes + s3 link
    if (stdout.indexOf('Summary') !== -1) {
      stdoutMod = stdout.substr(stdout.indexOf('Summary'));
    } 
    console.log(stdoutMod);
    workerUtils.logInMongo(
      currentJob,
      `${'    (stage)'.padEnd(15)}Finished pushing to staging`
    );
    workerUtils.logInMongo(
      currentJob,
      `${'    (stage)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`
    );
    workerUtils.populateCommunicationMessageInMongo(currentJob, stdoutMod);
  } catch (errResult) {
    if (
      errResult.hasOwnProperty('code') ||
      errResult.hasOwnProperty('signal') ||
      errResult.hasOwnProperty('killed')
    ) {
      workerUtils.logInMongo(
        currentJob,
        `${'    (stage)'.padEnd(15)}failed with code: ${errResult.code}`
      );
      workerUtils.logInMongo(
        currentJob,
        `${'    (stage)'.padEnd(15)}stdErr: ${errResult.stderr}`
      );
      throw errResult;
    }
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
    workerUtils.logInMongo(currentJob,`${'(BUILD)'.padEnd(15)}failed due to insufficient definition`);
    throw invalidJobDef;
  }

  // TODO: create logging class somewhere else.. for now it's here
  const Logger = function(currentJob) {
    return {
      save: function(message) {
        workerUtils.logInMongo(currentJob, message);
      }
    };
  };

  // instantiate github job class and logging class
  const job = new GitHubJob(currentJob);
  const logger = new Logger(currentJob);

  // start the entire build by running through the steps
  await startGithubBuild(job, logger);

  console.log('completed build');

  let branchext = '';
  let isMaster = true;

  if (currentJob.payload.branchName !== 'master') {
    branchext = '-' + currentJob.payload.branchName;
    isMaster = false;
  }

  if (isMaster) {
    //TODO: push to prod
  } else {
    console.log('pushing to stage');
    await workerUtils.promiseTimeoutS(
      buildTimeout,
      pushToStage(currentJob),
      'Timed out on push to stage'
    );
  }

  const files = workerUtils.getFilesInDir(
    './' + currentJob.payload.repoName + '/build/public' + branchext
  );

  return files;
}

module.exports = {
  runGithubPush,
  pushToStage,
  safeGithubPush,
};
