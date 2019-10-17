const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const simpleGit = require('simple-git/promise');

class GitHubJobClass {

  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
    this.deployCommands = [];
  }

  // get base path for public/private repos
  getBasePath() {
    const currentJob = this.currentJob;
    let basePath = `https://github.com`;
    if (currentJob.payload.private) {
      basePath = `https://${process.env.GITHUB_BOT_USERNAME}:${process.env.GITHUB_BOT_PASSWORD}@github.com`;
    }
    return basePath;
  }

  getRepoDirName() {
    return `${this.currentJob.payload.repoName}_${this.currentJob.payload.newHead}`;
  }

  // cleanup before pulling repo
  async cleanup(logger) {
    const currentJob = this.currentJob;
    logger.save(`${'(rm)'.padEnd(15)}Cleaning up repository`);
    try {
      workerUtils.removeDirectory(`repos/${this.getRepoDirName(currentJob)}`);
    } catch (errResult) {
      logger.save(`${'(CLEANUP)'.padEnd(15)}failed cleaning repo directory`);
      throw errResult;
    }
    return new Promise(function(resolve, reject) {
      logger.save(`${'(rm)'.padEnd(15)}Finished cleaning repo`);
      resolve(true);
    });
  }

  async cloneRepo(logger) {
    const currentJob = this.currentJob;
    logger.save(`${'(GIT)'.padEnd(15)}Cloning repository`);
    logger.save(`${'(GIT)'.padEnd(15)}running fetch`);
    try {
      if (!currentJob.payload.branchName) {
        logger.save(`${'(CLONE)'.padEnd(15)}failed due to insufficient definition`);
        throw new Error('branch name not indicated');
      }
      const basePath = this.getBasePath();
      const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;
      await simpleGit('repos')
        .silent(false)
        .clone(repoPath, `${this.getRepoDirName(currentJob)}`)
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
      logger.save(`${'(GIT)'.padEnd(15)}Finished git clone`);
      resolve(true);
    });
  }

  async buildRepo(logger) {
    const currentJob = this.currentJob;

    // setup for building
    await this.cleanup(logger);
    await this.cloneRepo(logger);

    logger.save(`${'(BUILD)'.padEnd(15)}Running Build`);
    logger.save(`${'(BUILD)'.padEnd(15)}running worker.sh`);

    try {
      const exec = workerUtils.getExecPromise();
      const basePath = this.getBasePath();
      const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;

      const pullRepoCommands = [
        `cd repos/${this.getRepoDirName(currentJob)}`,
        `git checkout ${currentJob.payload.branchName}`,
        `git pull origin ${currentJob.payload.branchName}`,
      ];

      await exec(pullRepoCommands.join(' && '));

      // default commands to run to build repo
      const commandsToBuild = [
        `. /venv/bin/activate`,
        `cd repos/${this.getRepoDirName(currentJob)}`,
        `make html`,
      ];

      const deployCommands = [
        `. /venv/bin/activate`,
        `cd repos/${this.getRepoDirName(currentJob)}`,
        `make stage`,
      ];

      // the way we now build is to search for a specific function string in worker.sh
      // which then maps to a specific target that we run
      const makeFileContents = fs.readFileSync(`repos/${this.getRepoDirName(currentJob)}/worker.sh`,{ encoding: 'utf8' });
      const makeFileLines = makeFileContents.split(/\r?\n/);
      
      // check if need to build next-gen instead
      for (let i = 0; i < makeFileLines.length; i++) {
        if (makeFileLines[i] === '"build-and-stage-next-gen"') {
          commandsToBuild[commandsToBuild.length - 1] = 'make next-gen-html';
          deployCommands[deployCommands.length - 1] = 'make next-gen-stage';
          break;
        }
      }

      // set this to data property so deploy class can pick it up later
      this.deployCommands = deployCommands;

      const execTwo = workerUtils.getExecPromise();

      const { stdout, stderr } = await execTwo(commandsToBuild.join(' && '));

      return new Promise(function(resolve, reject) {
        logger.save(`${'(BUILD)'.padEnd(15)}Finished Build`);
        logger.save(`${'(BUILD)'.padEnd(15)}worker.sh run details:\n\n${stdout}\n---\n${stderr}`);
        resolve({
          'status': 'success',
          'stdout': stdout,
          'stderr': stderr,
        });
      });
    } catch (errResult) {
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
  GitHubJobClass: GitHubJobClass
};