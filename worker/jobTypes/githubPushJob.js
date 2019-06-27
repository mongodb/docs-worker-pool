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

const keyLoc = '.config';
const keyFile = 'giza-aws-authentication.conf';


process.env.STITCH_ID = 'ref_data-bnbxq';
process.env.NAMESPACE = 'snooty/documents';

const invalidJobDef = new Error('job not valid');

const userDir = process.env.HOME;

//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(stringToCheck) {
  return (
    validator.isAscii(stringToCheck) &&
    validator.matches(stringToCheck, /^((\w)+[-]?(\w)+)*$/)
  );
}


async function initGithubPush() {
  const fileName = userDir + '/' + keyLoc + '/' + keyFile;
  if (!workerUtils.rootFileExists(fileName)) {
    await workerUtils.touchFile(fileName);
    await workerUtils.writeToFile(fileName, '[authentication]' + '\n' +
      `accesskey=${process.env.ACCESS_KEY}` + '\n' + `secretkey=${process.env.SECRET_KEY}`);
  } else {
    console.log('keyfile exists');
  }
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
    
    let repoPath =
      'https://github.com/' +
      currentJob.payload.repoOwner +
      '/' +
      currentJob.payload.repoName;
    
    console.log('repo path');
    console.log(repoPath);
    
    if (currentJob.payload.branchName != 'master') {
      const command = `git clone ${repoPath}; cd ${currentJob.payload.repoName}; git checkout ${
        currentJob.payload.branchName
        }; git pull origin ${currentJob.payload.branchName};`;
      
      await exec(command);
   
      const commandbuild = `. /venv/bin/activate; cd ${currentJob.payload.repoName}; chmod 755 worker.sh; ./worker.sh`;
      const execTwo = workerUtils.getExecPromise();
      await execTwo(commandbuild);

      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)}ran worker.sh`
      );

      console.log(stdout + ':' + stderr);
      
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
    let repoPath =
      'https://github.com/' +
      currentJob.payload.repoOwner +
      '/' +
      currentJob.payload.repoName;

    console.log(repoPath);

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
    console.log(stdout + ':' + stderr);
    workerUtils.logInMongo(
      currentJob,
      `${'    (stage)'.padEnd(15)}Finished pushing to staging`
    );
    workerUtils.populateCommunicationMessageInMongo(currentJob, stdout);
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
  await initGithubPush();
  
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
