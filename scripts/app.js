const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");
const dotenv = require("dotenv");

function insertJob(payload, jobTitle, jobUserName, jobUserEmail) {
  // look at this link: https://mongodb.github.io/node-mongodb-native/api-generated/collection.html

  console.log(JSON.stringify(context.user));

  //all of this I have to get from a env variable
  const db_name = process.env.DB_NAME;
  const coll_name = process.env.COL_NAME;

  // get the queue collection
  //   var queue = context.services
  //     .get("mongodb-atlas")
  //     .db(db_name)
  //     .collection(coll_name);

  // create the new job document
  const newJob = {
    title: jobTitle,
    user: jobUserName,
    email: jobUserEmail,
    status: "inQueue",
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    numFailures: 0,
    failures: [],
    result: null,
    payload: payload,
    logs: {}
  };

  // we are looking for jobs in the queue with the same payload that have not yet started (startTime == null)
  const filterDoc = { payload: payload, startTime: null };
  const updateDoc = { $setOnInsert: newJob };

  // upsert the new job and return if the upsertedId if the job was added to the queue
  //   return queue.updateOne(filterDoc, updateDoc, { upsert: true }).then(
  //     result => {
  //       if (result.upsertedId) {
  //         return result.upsertedId;
  //       } else {
  //         return "Already Existed";
  //       }
  //     },
  //     error => {
  //       return error;
  //     }
  //   );

  var MongoClient = require("mongodb").MongoClient;
  var url = "mongodb://localhost:27017/";

  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db(db_name);

    dbo
      .collection(coll_name)
      .updateOne(filterDoc, updateDoc, { upsert: true })
      .then(
        result => {
          if (result.upsertedId) {
            return result.upsertedId;
          } else {
            return "Already Existed";
          }
        },
        error => {
          return error;
        }
      );
  });
}

function createPayload(
  repoNameArg,
  branchNameArg,
  repoOwnerArg,
  urlArg,
  patch,
  buildSizeArg
) {
  hasHead = patch.substring(0, 10);
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
    newHead: hasHead,
    buildSize: buildSizeArg
  };

  return payload;
}

async function getBranchName() {
  return new Promise((resolve, reject) => {
    exec("git rev-parse --abbrev-ref HEAD", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      }

      resolve(stdout.replace("\n", ""));
    });
  });
}

async function getRepoInfo() {
  return new Promise((resolve, reject) => {
    exec(`git config --get remote.origin.url`, function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      }

      //extract repoName from url
      const repoUrl = stdout;
      let repoName = stdout.split("/");
      repoName = repoName[repoName.length - 1];
      repoName = repoName.replace(".git", "");
      repoName = repoName.replace("\n", "");

      resolve({ repoUrl, repoName });
    });
  });
}

async function getGitUser() {
  return new Promise((resolve, reject) => {
    exec("git config --global user.name", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      } else {
        resolve(stdout.replace("\n", ""));
      }
    });
  });
}

async function getGitCommits() {
  return new Promise((resolve, reject) => {
    exec("git cherry", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      } else {
        const cleanedup = stdout.replace(/\+ /g, "");
        let commitarray = cleanedup.split(/\r\n|\r|\n/);
        commitarray.length = commitarray.length - 1; //remove the last, dummy element that results from splitting on newline
        const firstCommit = commitarray[0];
        const lastCommit = commitarray[commitarray.length - 1];
        resolve({ firstCommit, lastCommit });
      }
    });
  });
}

async function getGitPatch(firstCommit, lastCommit) {
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
  const { url, repoName } = await getRepoInfo();
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

  console.log(payLoad);
  const success = insertJob(
    payload,
    "Github Push: " + userName + "/" + repoName,
    userName,
    "mez2113@columbia.edu"
  );
  console.log(success);
}

main();
