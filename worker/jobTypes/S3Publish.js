const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const FastlyJob = require('../utils/fastlyJob').FastlyJobClass;

class S3PublishClass {
  constructor(GitHubJob) {
    this.fastly = new FastlyJob(GitHubJob);
    this.GitHubJob = GitHubJob;
    fs.pathExists();
  }

  async pushToStage(logger) {
    logger.save(`${'(stage)'.padEnd(15)}Setting up push to staging function`);
    const stageCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      'make stage',
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
      let stdoutMod = stdout;
      logger.save(
        `${'(stage)'.padEnd(15)}Staging stderr details:\n\n${stderr}`
      );
      // get only last part of message which includes # of files changes + s3 link
      if (stdout.indexOf('Summary') !== -1) {
        stdoutMod = stdout.substr(stdout.indexOf('Summary'));
      }
      return new Promise((resolve) => {
        logger.save(`${'(stage)'.padEnd(15)}Finished pushing to staging`);
        logger.save(
          `${'(stage)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`
        );
        resolve({
          status: 'success',
          stdout: stdoutMod,
        });
      });
    } catch (errResult) {
      logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;

    }
  }

  async pushToProduction(logger) {
    logger.save(`${'(prod)'.padEnd(15)}Pushing to production`);
    const deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      'make publish',
      'make deploy',
    ];

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      deployCommands[deployCommands.length - 2] = 'make next-gen-publish';
      deployCommands[deployCommands.length - 1] = 'make next-gen-deploy';
    }

    try {
      const exec = workerUtils.getExecPromise();
      const command = deployCommands.join(' && ');
      const { stdout } = await exec(command);
      let stdoutMod = stdout;

      // check if json was returned from mut
      try {
        const stdoutJSON = JSON.parse(stdout);
        const urls = stdoutJSON.urls;
        // pass in urls to fastly function to purge cache
        this.fastly.purgeCache(urls).then(function(data) {
          logger.save(`${'(prod)'.padEnd(15)}Fastly finished purging URL's`);
          logger.sendSlackMsg(`All URL's finished purging for your deploy`);
        });
      } catch(e) {
        // if not JSON, then it's a normal string output from mut
        // get only last part of message which includes # of files changes + s3 link
        if (stdout.indexOf('Summary') !== -1) {
          stdoutMod = stdout.substr(stdout.indexOf('Summary'));
        }
      }

      return new Promise((resolve) => {
        logger.save(`${'(prod)'.padEnd(15)}Finished pushing to production`);
        logger.save(
          `${'(prod)'.padEnd(15)}Production deploy details:\n\n${stdoutMod}`
        );
        resolve({
          status: 'success',
          stdout: stdoutMod,
        });
      });
    } catch (errResult) {
      logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}

module.exports = {
  S3PublishClass,
};
