const workerUtils = require('../utils/utils');
const fs = require('fs-extra');

class GatsbyAdapterClass {
  constructor(GitHubJob) {
    this.GitHubJob = GitHubJob;
  }

  async initEnv(){

      try {
        let server_user = workerUtils.getServerUser();
        let envVars = `GATSBY_PARSER_USER=${server_user}
        GATSBY_PARSER_BRANCH=${this.currentJob.payload.branchName}`;
        pathPrefix = this.GitHubJob.payload.pathPrefix;

        if(pathPrefix){
          envVars += `\nPATH_PREFIX=${pathPrefix}\n`
        }
        console.log(envVars)
        fs.writeFile(`repos/${this.getRepoDirName()}/.env.production`, envVars,  { encoding: 'utf8', flag: 'w' }, function(err) {
            if(err) {
              console.log(`error writing .env.production file: ${err.stderr}`);
              throw err;
            }
        }); 
        //pass mutprefix back to caller to save in prefix field of currentJob, which we pass to stage and deploy targets

      } catch (error) {
       console.log(error)
       throw error 
      }
  }
}
  module.exports = {
    GatsbyAdapterClass,
  };
  