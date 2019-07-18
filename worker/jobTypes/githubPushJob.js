/**
 *  this is the github-triggered processor for builds
 *  it expects a worker.sh in the root of the repository
 *  an example job definition lives in jobDef.json
 */

const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const simpleGit = require('simple-git/promise');
const validator = require('validator');

const buildTimeout = 60 * 450;
const uploadToS3Timeout = 20;

const invalidJobDef = new Error('job not valid');

// get base path for public/private repos
function getBasePath(currentJob) {
  let basePath = `https://github.com`;
  if (currentJob.payload.private) {
    basePath = `https://${process.env.GITHUB_BOT_USERNAME}:${process.env.GITHUB_BOT_PASSWORD}@github.com`;
  }
  return basePath;
}

//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(stringToCheck) {
  return (
    validator.isAscii(stringToCheck) &&
    validator.matches(stringToCheck, /^((\w)+[-]?(\w)+)*$/)
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

  throw new Error('input invalid, exiting');
}

async function build(currentJob) {
  workerUtils.logInMongo(
    currentJob,
    `${'    (BUILD)'.padEnd(15)}Running Build`
  );
  // Perform the build --> exec is weird
  try {
    const exec = workerUtils.getExecPromise();
    workerUtils.logInMongo(
      currentJob,
      `${'    (BUILD)'.padEnd(15)}running worker.sh`
    );

    const basePath = getBasePath(currentJob);
    const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;
    
    console.log('repo path');
    console.log(repoPath);
    
    if (currentJob.payload.branchName != 'master') {
      const command = `cd ${currentJob.payload.repoName}; git checkout ${
        currentJob.payload.branchName
        }; git pull origin ${currentJob.payload.branchName};`;
      
      await exec(command);
   
      const commandbuild = `. /venv/bin/activate; cd ${currentJob.payload.repoName}; chmod 755 worker.sh; ./worker.sh`;
      const execTwo = workerUtils.getExecPromise();

      const { stdout, stderr } = await execTwo(commandbuild);

      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)}ran worker.sh`
      );

      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)}worker.sh run details:\n\n${stdout}\n---\n${stderr}`
      );

      // only post entire build output to slack if there are warnings
      const buildOutputToSlack = stdout + '\n\n' + stderr;
      if (buildOutputToSlack.indexOf('WARNING:') !== -1) {
        workerUtils.populateCommunicationMessageInMongo(currentJob, buildOutputToSlack);
      }
      
    } else {
      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)} failed, master branch not supported`
      );
      throw new Error('master branches not supported');
    }

  } catch (errResult) {
    console.log('error ' + errResult);
    if (
      errResult.hasOwnProperty('code') ||
      errResult.hasOwnProperty('signal') ||
      errResult.hasOwnProperty('killed')
    ) {
      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)}failed with code: ${errResult.code}`
      );
      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)}stdErr: ${errResult.stderr}`
      );
      throw errResult;
    }
  }
  console.log('finished build');
  workerUtils.logInMongo(
    currentJob,
    `${'    (BUILD)'.padEnd(15)}Finished Build`
  );
}

async function cloneRepo(currentJob) {
  workerUtils.logInMongo(
    currentJob,
    `${'    (GIT)'.padEnd(15)}Cloning repository`
  );
  if (!currentJob.payload.branchName) {
    workerUtils.logInMongo(
      currentJob,
      `${'    (CLONE)'.padEnd(15)}failed due to insufficient definition`
    );
    throw new Error('branch name not indicated');
  }
  // clone the repo we need to build
  try {

    const basePath = getBasePath(currentJob);
    const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;

    await simpleGit()
      .silent(false)
      .clone(repoPath)
      .catch(err => {
        console.error('failed: ', err);
        throw err;
      });
    workerUtils.logInMongo(currentJob, `${'    (GIT)'.padEnd(15)}ran fetch`);
  } catch (errResult) {
    if (
      errResult.hasOwnProperty('code') ||
      errResult.hasOwnProperty('signal') ||
      errResult.hasOwnProperty('killed')
    ) {
      workerUtils.logInMongo(
        currentJob,
        `${'    (GIT)'.padEnd(15)}failed with code: ${errResult.code}`
      );
      workerUtils.logInMongo(
        currentJob,
        `${'    (GIT)'.padEnd(15)}stdErr: ${errResult.stderr}`
      );
      // console.log('\n\nstdout:', errResult.stdout);
      throw errResult;
    }
  }

  workerUtils.logInMongo(
    currentJob,
    `${'    (GIT)'.padEnd(15)}Finished git clone`
  );
}

async function cleanup(currentJob) {
  workerUtils.logInMongo(
    currentJob,
    `${'    (rm)'.padEnd(15)}Cleaning up repository`
  );
  try {
    workerUtils.removeDirectory(currentJob.payload.repoName);
    workerUtils.logInMongo(
      currentJob,
      `${'    (rm)'.padEnd(15)}Finished cleaning repo`
    );
  } catch (errResult) {
    throw errResult;
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
    const command = `. /venv/bin/activate; cd ${currentJob.payload.repoName}; make stage;`;
    const { stdout, stderr } = await exec(command);
    let stdoutMod = '';
    console.log(stdout + ':' + stderr);
    // get only last part of message which includes # of files changes + s3 link
    if (stdout.indexOf('Summary') !== -1) {
      stdoutMod = stdout.substr(stdout.indexOf('Summary'));
    } 
    workerUtils.logInMongo(
      currentJob,
      `${'    (stage)'.padEnd(15)}Finished pushing to staging`
    );
    workerUtils.logInMongo(
      currentJob,
      `${'    (stage)'.padEnd(15)}Staging push details:\n\n${stdout}\n---\n${stderr}`
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
    workerUtils.logInMongo(
      currentJob,
      `${'    (BUILD)'.padEnd(15)}failed due to insufficient definition`
    );
    throw invalidJobDef;
  }

  // execute the build
  await workerUtils.promiseTimeoutS(
    buildTimeout,
    cleanup(currentJob),
    'Timed out on rm'
  );

  //clone the repo
  await workerUtils.promiseTimeoutS(
    buildTimeout,
    cloneRepo(currentJob),
    'Timed out on clone repo'
  );

  // execute the build
  await workerUtils.promiseTimeoutS(
    buildTimeout,
    build(currentJob),
    'Timed out on build'
  );

  console.log('competed build');

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
  cleanup,
  cloneRepo,
  build,
  safeGithubPush,
};
