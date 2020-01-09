const fs = require('fs-extra');
const workerUtils = require('../utils/utils');

class S3PublishClass {

  constructor(GitHubJob) {
    this.GitHubJob = GitHubJob;
  }

  async pushToStage(logger) {
    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);
    const stageCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      `make stage`, 
    ];

    // the way we now build is to search for a specific function string in worker.sh
    // which then maps to a specific target that we run
    const workerContents = fs.readFileSync(
      `repos/${this.GitHubJob.getRepoDirName()}/worker.sh`,
      { encoding: 'utf8' }
    );
    const workerLines = workerContents.split(/\r?\n/);

    // check if need to build next-gen instead
    for (let i = 0; i < workerLines.length; i++) {
      if (workerLines[i] === '"build-and-stage-next-gen"') {
        stageCommands[stageCommands.length - 1] = 'make next-gen-stage';
        break;
      }
    }

    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);

    try {
      const exec = workerUtils.getExecPromise();
      const command = stageCommands.join(' && ');
      const { stdout, stderr } = await exec(command);
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
      });
    } catch (errResult) {
      if (
        errResult.hasOwnProperty('code') ||
        errResult.hasOwnProperty('signal') ||
        errResult.hasOwnProperty('killed')
      ) {
        logger.save(
          `${'(stage)'.padEnd(15)}failed with code: ${errResult.code}`
        );
        logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
        throw errResult;
      }
    }
  }

  async pushToProduction(logger) {    
    const publishPrepCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      `make publish`
    ]
    const deployCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.GitHubJob.getRepoDirName()}`,
      `make publish`,
      `make stage`
    ];

    // the way we now build is to search for a specific function string in worker.sh
    // which then maps to a specific target that we run
    const workerContents = fs.readFileSync(
      `repos/${this.GitHubJob.getRepoDirName()}/worker.sh`,
      { encoding: 'utf8' }
    );
    const workerLines = workerContents.split(/\r?\n/);

    // check if need to build next-gen instead -- does this need to happen for make deploy as well???
    for (let i = 0; i < workerLines.length; i++) {
      if (workerLines[i] === '"build-and-stage-next-gen"') {
        deployCommands[deployCommands.length - 1] = 'make next-gen-stage';
        break;
      }
    }

    logger.save(`${'(stage)'.padEnd(15)}Pushing to staging`);

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
      if (
        errResult.hasOwnProperty('code') ||
        errResult.hasOwnProperty('signal') ||
        errResult.hasOwnProperty('killed')
      ) {
        logger.save(
          `${'(stage)'.padEnd(15)}failed with code: ${errResult.code}`
        );
        logger.save(`${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
        throw errResult;
      }
    }
  }
}

module.exports = {
  S3PublishClass: S3PublishClass
};