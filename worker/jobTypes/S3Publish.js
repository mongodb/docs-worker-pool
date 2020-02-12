const fs = require('fs-extra');
const workerUtils = require('../utils/utils');

class S3PublishClass {
  constructor(GitHubJob) {
    this.GitHubJob = GitHubJob;
    fs.pathExists();
  }

  async pushToStage(logger) {
    logger.save(`${'(stage)'.padEnd(15)}Setting up push to staging function`);
    const stageCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      `make stage`, 
    ];

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      stageCommands[stageCommands.length - 1] = 'make next-gen-stage';
    }

    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);

    try {
      const exec = workerUtils.getExecPromise();
      const command = stageCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
      logger.save(
        `${'(stage)'.padEnd(15)}Staging stderr details:\n\n${stderr}`
      );
      let stdoutMod = '';
      // get only last part of message which includes # of files changes + s3 link
      if (stdout.indexOf('Summary') !== -1) {
        stdoutMod = stdout.substr(stdout.indexOf('Summary'));
      }
      return new Promise(function(resolve, reject) {
        logger.save(`${'(stage)'.padEnd(15)}Finished pushing to staging`);
        logger.save(
          `${'(stage)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`
        );
        resolve({
          status: 'success',
          stdout: stdoutMod
        });
        reject({
          status: 'failure',
          stdout: stderr
        })
      });
    } catch (errResult) {
      logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }

  async pushToProduction(logger) {    
    logger.save(`${'(stage)'.padEnd(15)}Pushing to prod (JUST STAGING FOR NOW)`);
    const deployCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      `make publish`,
      `make stage`
    ];

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      deployCommands[deployCommands.length - 2] = 'make next-gen-publish';
      deployCommands[deployCommands.length - 1] = 'make next-gen-stage';
    }

    logger.save(`${'(stage)'.padEnd(15)}Pushing to production`);

    try {
      const exec = workerUtils.getExecPromise();
      const command = deployCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
      let stdoutMod = '';
      // get only last part of message which includes # of files changes + s3 link
      if (stdout.indexOf('Summary') !== -1) {
        stdoutMod = stdout.substr(stdout.indexOf('Summary'));
      }
      return new Promise(function(resolve, reject) {
        logger.save(`${'(prod)'.padEnd(15)}Finished pushing to production`);
        logger.save(
          `${'(prod)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`
        );
        resolve({
          status: 'success',
          stdout: stdoutMod
        });
      });
    } catch (errResult) {
      logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}

module.exports = {
  S3PublishClass: S3PublishClass
};
