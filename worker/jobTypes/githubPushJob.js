/** this is the github-triggered processor for builds
 *  it expects a worker.sh in the root of the repository
 *  an example job definition lives in jobDef.json
 */

const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
const simpleGit = require('simple-git/promise');
const validator = require('validator');

const buildTimeout = 60 * 450;
const uploadToS3Timeout = 20;

process.env.STITCH_ID = 'ref_data-bnbxq';
process.env.NAMESPACE = 'snooty/documents';

const invalidJobDef = new Error('job not valid');

module.exports = {

    //anything that is passed to an exec must be validated or sanitized
    //we use the term sanitize here lightly -- in this instance this validates
    sanitizeString(string) {
        return validator.isAscii(string) &&
        validator.matches(string, /^((\w)+[-]?(\w)+)*$/);
    },

    async sanitizeGithubPush(currentJob) {
         
        if (!currentJob ||
            !currentJob.payload ||
            !currentJob.payload.repoName ||
            !currentJob.payload.repoOwner ||
            !currentJob.payload.branchName) {
                workerUtils.logInMongo(currentJob, `${'    (sanitize)'.padEnd(15)}failed due to insufficient job definition`);
                throw invalidJobDef;
            }
        
        if (module.exports.sanitizeString(currentJob.payload.repoName) &&
        module.exports.sanitizeString(currentJob.payload.repoOwner) &&
        module.exports.sanitizeString(currentJob.payload.branchName)) {
            return true;
        }

        throw new Error('input invalid, exiting');

    },
    
    async build(currentJob) {
        workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)}Running Build`);
        // Perform the build --> exec is weird
        try {

            const exec = workerUtils.getExecPromise();
            workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)}running worker.sh`);
            let command = 'cd ' + currentJob.payload.repoName + '; ./worker.sh';

            if (currentJob.payload.branchName!='master') {
                command = `cd ` + currentJob.payload.repoName + `; git checkout ` + currentJob.payload.branchName
                    + '; ./worker.sh';
            } else {
                workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)} failed, master branch not supported`);
                throw new Error('master branches not supported');   
            }
            
            await exec(command);
  
        } catch (errResult) {
            if (errResult.hasOwnProperty('code') || errResult.hasOwnProperty('signal') || errResult.hasOwnProperty('killed')) {
                workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)}failed with code: ${errResult.code}`);
                workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)}stdErr: ${errResult.stderr}`);
                throw errResult;
            }
        }

        workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)}Finished Build`);
    },

    async cloneRepo(currentJob) {
        workerUtils.logInMongo(currentJob, `${'    (GIT)'.padEnd(15)}Cloning repository`);
        if (!currentJob.payload.branchName) {
            workerUtils.logInMongo(currentJob, `${'    (CLONE)'.padEnd(15)}failed due to insufficient definition`);
            throw new Error('branch name not indicated');
        }
        // clone the repo we need to build
        try {

            let repoPath = 'https://github.com/' + currentJob.payload.repoOwner + '/' + currentJob.payload.repoName;
           
            await simpleGit().silent(false)
            .clone(repoPath)
            .catch((err) => {
                console.error('failed: ', err);
                throw err;
            });

            workerUtils.logInMongo(currentJob, `${'    (GIT)'.padEnd(15)}ran fetch`);

        } catch (errResult) {
            if (errResult.hasOwnProperty('code') || errResult.hasOwnProperty('signal') || errResult.hasOwnProperty('killed')) {
                workerUtils.logInMongo(currentJob, `${'    (GIT)'.padEnd(15)}failed with code: ${errResult.code}`);
                workerUtils.logInMongo(currentJob, `${'    (GIT)'.padEnd(15)}stdErr: ${errResult.stderr}`);
                // console.log('\n\nstdout:', errResult.stdout);
                throw errResult;
            }
        }

        workerUtils.logInMongo(currentJob, `${'    (GIT)'.padEnd(15)}Finished git clone`);
    },

    async cleanup(currentJob) {
        workerUtils.logInMongo(currentJob, `${'    (rm)'.padEnd(15)}Cleaning up repository`);
        try {
            workerUtils.removeDirectory(currentJob.payload.repoName);
            workerUtils.logInMongo(currentJob, `${'    (rm)'.padEnd(15)}Finished cleaning repo`);
        } catch (errResult) {
           throw errResult;
        }
    },

    async pushToStage(currentJob) {
        workerUtils.logInMongo(currentJob, `${'    (stage)'.padEnd(15)}Pushing to staging`);
        // change working dir to the repo we need to build
        try {
            const exec = workerUtils.getExecPromise();
            const command = `cd ` + currentJob.payload.repoName + `; git checkout ` + currentJob.payload.branchName
                    + '; make stage';
            const { stdout } = await exec(command);
            workerUtils.logInMongo(currentJob, `${'    (stage)'.padEnd(15)}Finished pushing to staging`);   
            workerUtils.populateCommunicationMessageInMongo(currentJob, stdout);
        } catch (errResult) {
            if (errResult.hasOwnProperty('code') || errResult.hasOwnProperty('signal') || errResult.hasOwnProperty('killed')) {
                workerUtils.logInMongo(currentJob, `${'    (stage)'.padEnd(15)}failed with code: ${errResult.code}`);
                workerUtils.logInMongo(currentJob, `${'    (stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
                // console.log('\n\nstdout:', errResult.stdout);
                throw errResult;
            }
        }
        

    },

    async runGithubPush(currentJob) {
        workerUtils.logInMongo(currentJob, ' ** Running github push function');
    
        if (!currentJob ||
            !currentJob.payload ||
            !currentJob.payload.repoName ||
            !currentJob.payload.branchName) {
                workerUtils.logInMongo(currentJob, `${'    (BUILD)'.padEnd(15)}failed due to insufficient definition`);
                throw invalidJobDef;
            }  

        // execute the build
        await workerUtils.promiseTimeoutS(
            buildTimeout,
            module.exports.cleanup(currentJob),
            'Timed out on rm',
        );

        //clone the repo
        await workerUtils.promiseTimeoutS(
            buildTimeout,
            module.exports.cloneRepo(currentJob),
            'Timed out on clone repo',
        );

        // execute the build
        await workerUtils.promiseTimeoutS(
            buildTimeout,
            module.exports.build(currentJob),
            'Timed out on build',
        );

        var branchext = '';
        var isMaster = true;

        if (currentJob.payload.branchName!='master') {
            branchext = '-' + currentJob.payload.branchName;
            isMaster = false;
        }

        if (isMaster) {
            //push to prod
        } else {
            await workerUtils.promiseTimeoutS(
                buildTimeout,
                module.exports.pushToStage(currentJob),
                'Timed out on push to stage',
            );
        }

        const files = workerUtils.getFilesInDir('./' + currentJob.payload.repoName + "/build/public" + branchext);

        return files;
    },
};
