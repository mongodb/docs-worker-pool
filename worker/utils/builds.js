// Imports
const path = require('path');
const fs = require('fs-extra');
const workerUtils = require('../utils/utils');

module.exports = {

  async build(currentJob) {
    workerUtils.logInMongo(
      currentJob,
      `${'    (BUILD)'.padEnd(15)}Running Build`
    );
    // Perform the build --> exec is weird
    try {
      const exec = workerUtils.getExecPromise();
      workerUtils.logInMongo(
        currentJob,
        `${'    (BUILD)'.padEnd(15)}running worker.sh`
      );

      const basePath = workerUtils.getBasePath(currentJob);
      const repoPath = basePath + '/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;
      
      if (currentJob.payload.branchName != 'master') {
        const command = `cd repos/${workerUtils.getRepoDirName(currentJob)}; git checkout ${
          currentJob.payload.branchName
          }; git pull origin ${currentJob.payload.branchName};`;
        
        await exec(command);
     
        const commandbuild = `. /venv/bin/activate; cd repos/${workerUtils.getRepoDirName(currentJob)}; chmod 755 worker.sh; ./worker.sh`;
        const execTwo = workerUtils.getExecPromise();

        const { stdout, stderr } = await execTwo(commandbuild);

        workerUtils.logInMongo(
          currentJob,
          `${'    (BUILD)'.padEnd(15)}ran worker.sh`
        );

        workerUtils.logInMongo(
          currentJob,
          `${'    (BUILD)'.padEnd(15)}worker.sh run details:\n\n${stdout}\n---\n${stderr}`
        );

        // only post entire build output to slack if there are warnings
        const buildOutputToSlack = stdout + '\n\n' + stderr;

        if (buildOutputToSlack.indexOf('WARNING:') !== -1) {
          workerUtils.populateCommunicationMessageInMongo(currentJob, buildOutputToSlack);
        }
        
      } else {
        workerUtils.logInMongo(
          currentJob,
          `${'    (BUILD)'.padEnd(15)} failed, master branch not supported`
        );
        throw new Error('master branches not supported');
      }

    } catch (errResult) {
      console.log('error ' + errResult);
      if (
        errResult.hasOwnProperty('code') ||
        errResult.hasOwnProperty('signal') ||
        errResult.hasOwnProperty('killed')
      ) {
        workerUtils.logInMongo(
          currentJob,
          `${'    (BUILD)'.padEnd(15)}failed with code: ${errResult.code}`
        );
        workerUtils.logInMongo(
          currentJob,
          `${'    (BUILD)'.padEnd(15)}stdErr: ${errResult.stderr}`
        );
        throw errResult;
      }
    }
    console.log('finished build');
    workerUtils.logInMongo(
      currentJob,
      `${'    (BUILD)'.padEnd(15)}Finished Build`
    );
  },

};
