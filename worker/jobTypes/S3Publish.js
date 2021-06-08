const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const FastlyJob = require('../utils/fastlyJob').FastlyJobClass;

class S3PublishClass {
  constructor (GitHubJob) {
    this.fastly = new FastlyJob(GitHubJob);
    this.GitHubJob = GitHubJob;
    fs.pathExists();
  }

  async pushToStage (logger) {
    logger.save(`${'(stage)'.padEnd(15)}Setting up push to staging function`);
    const stageCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      'make stage'
    ];

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      if (this.GitHubJob.currentJob.payload.pathPrefix) {
        stageCommands[stageCommands.length - 1] = `make next-gen-stage MUT_PREFIX=${this.GitHubJob.currentJob.payload.mutPrefix}`;
      } else {
        // front end constructs path prefix for regular githubpush jobs and commitless staging jobs
        stageCommands[stageCommands.length - 1] = 'make next-gen-stage'
      }
    }

    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);
    try {
      const exec = workerUtils.getExecPromise();
      const command = stageCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
      let stdoutMod = stdout;

      if (stderr && stderr.indexOf('ERROR') !== -1) {
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
        logger.save(
          `${'(stage)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`
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

  async pushToProduction (logger) {
    logger.save(`${'(prod)'.padEnd(15)}Pushing to production`);

    // this is the final command to deploy
    // will either return summary message from mut or json
    const deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      'make publish && make deploy'
    ];

    // check if need to build next-gen
    if (this.GitHubJob.buildNextGen()) {
      const manifestPrefix = this.GitHubJob.currentJob.payload.manifestPrefix
      
      deployCommands[deployCommands.length - 1] = `make next-gen-deploy MUT_PREFIX=${this.GitHubJob.currentJob.payload.mutPrefix}`;
      //set makefile vars related to search indexing if this is a build we are supposed to index
      //as defined in githubJob.js
      if (manifestPrefix) deployCommands[deployCommands.length - 1] +=  ` MANIFEST_PREFIX=${manifestPrefix} GLOBAL_SEARCH_FLAG=${this.GitHubJob.currentJob.payload.stableBranch}`;
    }

    // deploy site
    try {
      const exec = workerUtils.getExecPromise();
      const command = deployCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
      let stdoutMod = stdout;

      if (stderr && stderr.indexOf('ERROR') !== -1) {
        logger.save(
          `${'(prod)'.padEnd(15)}Failed to push to prod`
        );
        throw new Error(`Failed pushing to prod: ${stderr}`)
      }

      try {
        const makefileOutput = stdout.replace(/\r/g, '').split(/\n/);
        // the URLS are always third line returned bc of the makefile target
        const stdoutJSON = JSON.parse(makefileOutput[2]);
        //contains URLs corresponding to files updated via our push to S3
        const updatedURLsArray = stdoutJSON.urls;
        // purgeCache purges the now stale content and requests the URLs to warm the cache for our users
        logger.save(`${JSON.stringify(updatedURLsArray)}`);
        await this.fastly.purgeCache(updatedURLsArray);
        //save purged URLs to job object
        await workerUtils.updateJobWithPurgedURLs(this.GitHubJob.currentJob, updatedURLsArray);

        return new Promise((resolve) => {
          logger.save(`${'(prod)'.padEnd(15)}Finished pushing to production`);
          logger.save(`${'(prod)'.padEnd(15)}Deploy details:\n\n${stdoutMod}`);
          resolve({
            status: 'success',
            stdout: stdoutMod,
            });
          },);
      } catch (error) {
      console.trace(error)
      throw(error)
    }
  }     
  catch (errResult) {
  logger.save(`${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
  throw errResult;
}
  }
}

module.exports = {
  S3PublishClass,
};
