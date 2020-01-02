const fs = require('fs-extra');
const workerUtils = require('../utils/utils');

class S3PublishClass {

  constructor(GitHubJob) {
    this.GitHubJob = GitHubJob;
  }

  async pushToStage(logger) {
    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);
    
    try {
      console.log("we gonna try something!!!")
      const exec = workerUtils.getExecPromise();
      const command = this.GitHubJob.deployCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
      let stdoutMod = '';
      // get only last part of message which includes # of files changes + s3 link
      if (stdout.indexOf('Summary') !== -1) {
        stdoutMod = stdout.substr(stdout.indexOf('Summary'));
      } 
      return new Promise(function(resolve, reject) {
        console.log("we are in the resolve so it should be good!!!1");
        logger.save(`${'(stage)'.padEnd(15)}Finished pushing to staging`);
        logger.save(`${'(stage)'.padEnd(15)}Staging push details:\n\n${stdoutMod}`);
        resolve({
          'status': 'success',
          'stdout': stdoutMod,
        });
      });
    } catch (errResult) {
      this.dumpError(errResult);
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


dumpError(err) {
    if (typeof err === 'object') {
      if (err.message) {
        console.log('\nMessage: ' + err.message)
      }
      if (err.stack) {
        console.log('\nStacktrace:')
        console.log('====================')
        console.log(err.stack);
      }
    } else {
      console.log('dumpError :: argument is not an object');
    }
  }

  async pushToProduction(logger) {
    // todo
  }

}

module.exports = {
  S3PublishClass: S3PublishClass
};