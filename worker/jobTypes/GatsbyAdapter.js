const workerUtils = require('../utils/utils');
const fs = require('fs-extra');

class GatsbyAdapterClass {
  constructor(GitHubJob) {
    console.log("constructor called!! for gatsby adapter")
    this.GitHubJob = GitHubJob;
  }

  async initEnv(){
      console.log("yay ive been called!!!! ", this.GitHubJob)
      try {
        let server_user = workerUtils.getServerUser();
        let envVars = `GATSBY_PARSER_USER=${server_user}
        GATSBY_PARSER_BRANCH=${this.GitHubJob.currentJob.payload.branchName}`;
        const pathPrefix = this.GitHubJob.currentJob.payload.pathPrefix;

        if(pathPrefix){
          envVars += `\nPATH_PREFIX=${pathPrefix}\n`
        }
        console.log(envVars)
        fs.writeFile(`repos/${this.GitHubJob.currentJob.payload.repoName}/.env.production`, envVars,  { encoding: 'utf8', flag: 'w' }, function(err) {
            if(err) {
              console.log(`error writing .env.production file: ${err.stderr}`);
              throw err;
            }
            console.log("no issue here!")
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
  