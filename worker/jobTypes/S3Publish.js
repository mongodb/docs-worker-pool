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
      if(this.GitHubJob.currentJob.payload.pathPrefix){
        stageCommands[stageCommands.length - 1] = `make next-gen-stage ${this.GitHubJob.currentJob.payload.mutPrefix}`;
      }
      //front end constructs path prefix for regular githubpush jobs and commitless staging jobs
      else{
        stageCommands[stageCommands.length - 1] = `make next-gen-stage`
      }

    }

    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);
    try {
      const exec = workerUtils.getExecPromise();
      const command = stageCommands.join(' && ');
      const {stdout, stderr } = await exec(command);
      let stdoutMod = stdout;
      
      if(stderr && stderr.indexOf('ERROR') !== -1) {
        logger.save(
          `${'(stage)'.padEnd(15)}Failed to push to staging`
        );
        throw new Error(`Failed pushing to staging: ${stderr}`)
      }
      // get only last part of message which includes # of files changes + s3 link
      if (stdout.indexOf('Summary') !== -1) {
        stdoutMod = stdout.substr(stdout.indexOf('Summary'));
      }
      return new Promise((resolve) => {
        logger.save(`${'(stage)'.padEnd(15)}Finished pushing to staging`);
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

    // this is the final command to deploy
    // will either return summary message from mut or json
    const deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      'make deploy',
    ];

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      deployCommands[deployCommands.length - 1] = `make next-gen-deploy ${this.GitHubJob.currentJob.payload.mutPrefix}`;
    }

    // deploy site
    try {
      const exec = workerUtils.getExecPromise();
      const command = deployCommands.join(' && ');
      const {stdout, stderr } = await exec(command);
      let stdoutMod = stdout;

      if(stderr && stderr.indexOf('ERROR') !== -1) {
        logger.save(
          `${'(stage)'.padEnd(15)}Failed to push to staging`
        );
        throw new Error(`Failed pushing to staging: ${stderr}`)
      }
      // check for json string output from mut
      const validateJsonOutput = stdout ? stdout.substr(0, stdout.lastIndexOf(']}') + 2) : '';

      // check if json was returned from mut
      try {
        const stdoutJSON = JSON.parse(validateJsonOutput);
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