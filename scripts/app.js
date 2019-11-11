const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");

function createPayload(repoName, branchName, repoOwner, url, patch, buildSize) {
  const payload = {
    jobType: "githubPatch",
    source: "github",
    action: "push",
    repoName: "docs-bi-connector",
    branchName: "test2",
    isFork: true,
    private: false,
    isXlarge: false,
    repoOwner: "madelinezec",
    url: "https://github.com/madelinezec/docs-bi-connector.git",
    newHead: "17330b506db3993d9ed1a916ada1f4a0f473b3ac"
  };
}



async function getGitUser() {
  console.log("one");
  return new Promise((resolve, reject) => {
  exec("git config --global user.name", function(
    error,
    stdout,
    stderr
  ) {
    if (error !== null) {
      console.log("exec error: " + error);
    }
    resolve(stdout)
  });

})}

async function getGitCommits() {
  console.log("two");
  return new Promise((resolve, reject) => {
    exec("git cherry", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      } else {
        const cleanedup = stdout.replace(/\+ /g, "");
        let commitarray = cleanedup.split(/\r\n|\r|\n/);
        commitarray.length = commitarray.length - 1; //remove the last, dummy element that results from splitting on newline
        console.log(commitarray)
        const firstCommit = commitarray[0];
        const lastCommit = commitarray[commitarray.length - 1];
        resolve({firstCommit, lastCommit});
      }
    });
  });
}

async function getGitPatch(firstCommit, lastCommit) {
  console.log("three");
  return new Promise((resolve, reject) => {
   exec(
    "git diff " + firstCommit + "..." + lastCommit + " > myPatch.patch",
    function(error, stdout, stderr) {
      if (error !== null) {
        console.log(error);
        reject(error);
      } else {
        console.log(stdout);
        
          fs.readFile("myPatch.patch", "utf8", function(err, data) {
              resolve(data);
          })
        
      }
    }
  )});
}

async function main() {

     const name = await getGitUser();
     const {firstCommit, lastCommit} = await getGitCommits();
     const patch = await getGitPatch(firstCommit, lastCommit);

}

main();
