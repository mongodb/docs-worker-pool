const workerUtils = require('../utils/utils');
const fs = require('fs-extra');

class GatsbyAdapterClass {
  constructor(GitHubJob) {
    this.GitHubJob = GitHubJob;
  }

  async constructEnvVars(){
    let server_user = await workerUtils.getServerUser();
    let envVars = `GATSBY_PARSER_USER=${server_user}\nGATSBY_PARSER_BRANCH=${this.GitHubJob.currentJob.payload.branchName}\n`;
    const pathPrefix = this.GitHubJob.currentJob.payload.pathPrefix;

    if(typeof pathPrefix !== 'undefined' && pathPrefix !== null){
      envVars += `PATH_PREFIX=${pathPrefix}\n`
		}

    // PUT ENVIRONMENT VARIABLES FOR SNOOTY FRONTEND HERE
    // in a key value format e.g.
    // 'GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION': process.env.GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION
    // If no environment variables are needed, please leave this as an empty object
    const snootyFrontEndVars = {
      'GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION': process.env.GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION,
      'GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN': process.env.GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN,
    };

    for (const[envName, envValue] of Object.entries(snootyFrontEndVars)) {
      const isTruthyEnv = (envValue && String(envValue).toUpper() !== 'FALSE')
      if (isTruthyEnv) envVars += `${envName}=${envValue}\n`;
    }

    return envVars
  }

  async initEnv(){
      try {
        const envVars = await this.constructEnvVars();

        fs.writeFile(`repos/${this.GitHubJob.currentJob.payload.repoName}/.env.production`, envVars,  { encoding: 'utf8', flag: 'w' }, function(err) {
            if(err) {
              console.log(`error writing .env.production file: ${err.stderr}`);
              throw err;
            }
        });
      } catch (error) {
       console.log(error);
       throw error;
      }
  }
}

module.exports = {
  GatsbyAdapterClass,
};
