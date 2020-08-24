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

    if(pathPrefix){
      envVars += `PATH_PREFIX=${pathPrefix}\n`
    }
    return envVars
  }

  async initEnv(){
      try {
        const envVars = await this.writeEnvVars();

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
  