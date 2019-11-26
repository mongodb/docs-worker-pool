const fs = require('fs-extra');
const workerUtils = require('../utils/utils');

class S3PublishClass {

  constructor(GitHubJob) {
    this.GitHubJob = GitHubJob;
  }

  async pushToStage(logger) {
    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);
    try {
      const exec = workerUtils.getExecPromise();
      const command = this.GitHubJob.deployCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
      let stdoutMod = '';
      // get only last part of message which includes # of files changes + s3 link
      if (stdout.indexOf('Summary') !== -1) {
        stdoutMod = stdout.substr(stdout.indexOf('Summary'));
      } 
      return new Promise(function(resolve, reject) {
        logger.save(`${'(stage)'.padEnd(15)}Finished pushing to staging`);
        logger.save(`${'(stage)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`);
        resolve({
          'status': 'success',
          'stdout': stdoutMod,
        });
      });
    } catch (errResult) {
      console.log("inside s3 catch!! ", errResult)

  //     TypeError [ERR_INVALID_ARG_VALUE]: The argument 'file' cannot be empty. Received ''
  //   at normalizeSpawnArguments (child_process.js:401:11)
  //   at spawn (child_process.js:534:16)
  //   at Object.execFile (child_process.js:224:17)
  //   at exec (child_process.js:145:25)
  //   at child_process.js:159:29
  //   at S3PublishClass.pushToStage (/home/docsworker/jobTypes/S3Publish.js:15:40)
  //   at pushToStage (/home/docsworker/jobTypes/githubPushJob.js:71:15)
  //   at Object.runGithubPush [as function] (/home/docsworker/jobTypes/githubPushJob.js:137:11)
  //   at processTicksAndRejections (internal/process/task_queues.js:93:5)
  //   at async Timeout.work [as _onTimeout] (/home/docsworker/worker.js:169:24) {
  // code: 'ERR_INVALID_ARG_VALUE'


      if (
        errResult.hasOwnProperty('code') ||
        errResult.hasOwnProperty('signal') ||
        errResult.hasOwnProperty('killed')
      ) {
        logger.save(`${'(stage)'.padEnd(15)}failed with code: ${errResult.code}`);
        logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
        throw errResult;
      }
    }
  }

  async pushToProduction(logger) {
    // todo
  }

}

module.exports = {
  S3PublishClass: S3PublishClass
};