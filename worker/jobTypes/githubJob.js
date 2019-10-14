const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const simpleGit = require('simple-git/promise');

class GitHubJobClass {

  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
  }

  // cleanup before pulling repo
  async cleanup(logger) {
    const currentJob = this.currentJob;
    try {
      workerUtils.removeDirectory(`repos/${workerUtils.getRepoDirName(currentJob)}`);
    } catch (errResult) {
      logger.save(`${'(CLEANUP)'.padEnd(15)}failed cleaning repo directory`);
      throw errResult;
    }
    return new Promise(function(resolve, reject) {
      resolve(true);
    });
  }

  async cloneRepo(logger) {
    const currentJob = this.currentJob;
    try {
      if (!currentJob.payload.branchName) {
        logger.save(`${'(CLONE)'.padEnd(15)}failed due to insufficient definition`);
        throw new Error('branch name not indicated');
      }
      const basePath = workerUtils.getBasePath(currentJob);
      const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;
      await simpleGit('repos')
        .silent(false)
        .clone(repoPath, `${workerUtils.getRepoDirName(currentJob)}`)
        .catch(err => {
          console.error('failed: ', err);
          throw err;
        });
    } catch (errResult) {
      if (
        errResult.hasOwnProperty('code') ||
        errResult.hasOwnProperty('signal') ||
        errResult.hasOwnProperty('killed')
      ) {
        logger.save(`${'(GIT)'.padEnd(15)}failed with code: ${errResult.code}`);
        logger.save(`${'(GIT)'.padEnd(15)}stdErr: ${errResult.stderr}`);
        throw errResult;
      }
    }
    return new Promise(function(resolve, reject) {
      resolve(true);
    });
  }

  async buildRepo(logger) {
    const currentJob = this.currentJob;
    try {
      // master branch cannot run through staging build
      if (currentJob.payload.branchName === 'master') {
        logger.save(`${'(BUILD)'.padEnd(15)} failed, master branch not supported`);
        throw new Error('master branches not supported');
      }

      const exec = workerUtils.getExecPromise();
      const basePath = workerUtils.getBasePath(currentJob);
      const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;

      const command = `
        cd repos/${workerUtils.getRepoDirName(currentJob)}; 
        git checkout ${currentJob.payload.branchName}; 
        git pull origin ${currentJob.payload.branchName};
      `;

      await exec(command);
   
      const commandbuild = `
        . /venv/bin/activate; 
        cd repos/${workerUtils.getRepoDirName(currentJob)}; 
        chmod 755 worker.sh; ./worker.sh
      `;

      const execTwo = workerUtils.getExecPromise();

      const { stdout, stderr } = await execTwo(commandbuild);

      return new Promise(function(resolve, reject) {
        resolve({
          'status': 'success',
          'stdout': stdout,
          'stderr': stderr,
        });
      });
    } catch (errResult) {
      console.log('error ' + errResult);
      if (
        errResult.hasOwnProperty('code') ||
        errResult.hasOwnProperty('signal') ||
        errResult.hasOwnProperty('killed')
      ) {
        logger.save(`${'(BUILD)'.padEnd(15)}failed with code: ${errResult.code}`);
        logger.save(`${'(BUILD)'.padEnd(15)}stdErr: ${errResult.stderr}`);
        throw errResult;
      }
    }
  }

}

module.exports = {
  GitHubJob: GitHubJobClass
};