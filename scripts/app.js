const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");

function createPayload(
  repoNameArg,
  branchNameArg,
  repoOwnerArg,
  urlArg,
  patch,
  buildSize
) {
    console.log(patch.substring(0, 10))
  const payload = {
    jobType: "githubPatch",
    source: "github",
    action: "push",
    repoName: repoNameArg,
    branchName: branchNameArg,
    isFork: true,
    private: false,
    isXlarge: false,
    repoOwner: repoOwnerArg,
    url: urlArg,
    newHead: patch.substring(0, 10)
  };

  return payload;
}

async function getBranchName() {
  return new Promise((resolve, reject) => {
    exec("git branch | grep * | cut -d ' ' -f2", function(
      error,
      stdout,
      stderr
    ) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      }
      resolve(stdout);
    });
  });
}

async function getRepoInfo() {
  return new Promise((resolve, reject) => {
    exec(`git config --get remote.origin.url`, function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
      }

      //extract repoName from url
      let repoName = stdout.split("/");
      repoName = repoName[repoName.length - 1];
      repoName = repoName.replace(".git", "");
      resolve({ stdout, repoName });
    });
  });
}

async function getGitUser() {
  console.log("one");
  return new Promise((resolve, reject) => {
    exec("git config --global user.name", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
      }
      resolve(stdout);
    });
  });
}

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
        console.log(commitarray);
        const firstCommit = commitarray[0];
        const lastCommit = commitarray[commitarray.length - 1];
        resolve({ firstCommit, lastCommit });
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
          fs.readFile("myPatch.patch", "utf8", function(err, data) {
            resolve(data);
          });
        }
      }
    );
  });
}

async function main() {
  //world or repo build is passed in through cmd line/makefil

  const buildSize = process.argv[2];
  const userName = await getGitUser();
  const { repoName, url } = await getRepoInfo();
  const branchName = await getBranchName();
  const { firstCommit, lastCommit } = await getGitCommits();
  const patch = await getGitPatch(firstCommit, lastCommit);
  const payLoad = await createPayload(
    repoName,
    branchName,
    userName,
    url,
    patch,
    buildSize
  );
}

main();
