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

    const publishCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      'make publish',
    ];

    // this is the final command to deploy
    // will either return summary message from mut or json
    let deployCommand = 'make deploy';

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      publishCommands[publishCommands.length - 1] = 'make next-gen-publish';
      deployCommand = 'make next-gen-deploy';
    }

    // first publish
    try {
      const exec = workerUtils.getExecPromise();
      const command = publishCommands.join(' && ');
      const { stdout } = await exec(command);
      logger.save(
        `${'(prod)'.padEnd(15)}Production publish details:\n\n${stdout}`
      );
    } catch (errResult) {
      logger.save(`${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }

    // finally deploy site
    try {
      const exec = workerUtils.getExecPromise();
      const command = deployCommand;
      const { stdout } = await exec(command);
      let stdoutMod = stdout;

      // check if json was returned from mut
      try {
        const stdoutJSON = JSON.parse(stdout);
        const urls = stdoutJSON.urls;
        // pass in urls to fastly function to purge cache
        this.fastly.purgeCache(urls).then(function(data) {
          logger.save(`${'(prod)'.padEnd(15)}Fastly finished purging URL's`);
          logger.sendSlackMsg(`Fastly Summary: The following pages were purged from cache for your deploy`);
          // when finished purging
          // batch urls to send as single slack message
          let batchedUrls = [];
          for (let i = 0; i < urls.length; i++) {
            const purgedUrl = urls[i];
            if (purgedUrl && purgedUrl.indexOf('.html') !== -1) {
              batchedUrls.push(purgedUrl);
            }
            // if over certain length, send as a single slack message and reset the array
            if (batchedUrls.length > 20 || i >= (urls.length - 1)) {
              logger.sendSlackMsg(`${batchedUrls.join('\n')}`);
              batchedUrls = [];
            }
          }
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
      logger.save(`${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}

module.exports = {
  S3PublishClass,
};
