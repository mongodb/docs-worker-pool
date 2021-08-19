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
    // TODO: Make this into an actual abstraction somewhere if we keep this structure for writing env.production
    // should be its own service, and much more accessible than this
    if (process.env.GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION) {
      envVars += `GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION=${process.env.GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION}\n`;
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
       console.log(error)
       throw error 
      }
  }
}
  module.exports = {
    GatsbyAdapterClass,
  };
  