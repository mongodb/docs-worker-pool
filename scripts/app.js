const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");
const dotenv = require("dotenv");
const result = dotenv.config();

if (result.error) {
  if(result.error.errno === -2){
    console.log("The .env file does not exist. You cannot stage a build without this file.")
    return
  }
}

const { parsed: envs } = result;

if(process.env.DB_NAME === undefined || process.env.DB_NAME === ""){
  console.log("The database name is not defined in the environment variables. Check the .env file for DB_NAME")
}
if(process.env.COL_NAME === undefined || process.env.COL_NAME === ""){
  console.log("The column name is not defined in the environment variables. Check the .env file for COL_NAME")
}
if(process.env.USERNAME === undefined || process.env.USERNAME === ""){
  console.log("The username is not defined in the environment variables. Check the .env file for USERNAME")
}

if(process.env.SECRET === undefined || process.env.SECRET === ""){
  console.log("The access token is not defined in the environment variables. Check the .env file for SECRET")
}

function insertJob(payload, jobTitle, jobUserName, jobUserEmail) {
  const db_name = process.env.DB_NAME;
  const coll_name = process.env.COL_NAME;
  const username = process.env.USERNAME;
  const secret = process.env.SECRET;
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

  const MongoClient = require("mongodb").MongoClient;
  const uri =
    "mongodb+srv://" +
    username +
    ":" +
    secret +
    "@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority";
  const client = new MongoClient(uri, { useNewUrlParser: true });
  client.connect(err => {
    const collection = client.db("pool_test").collection("queue");
    collection.updateOne(filterDoc, updateDoc, { upsert: true }).then(
      result => {
        if (result.upsertedId) {
          console.log("You successfully enqued a staging job to docs autobuilder. This is the record id: ", result.upsertedId)
          return result.upsertedId;
        } else {
          return "Already Existed";
        }
      },
      error => {
        console.log("There was an error enqueing a staging job to docs autobuilder. Here is the error: \n", error);
        return error;
      }
    );
    client.close();
  });
}

function createPayload(
  repoNameArg,
  branchNameArg,
  repoOwnerArg,
  urlArg,
  patchArg,
  buildSizeArg,
  lastCommit
) {
  const payload = {
    jobType: "githubPush",
    source: "github",
    action: "push",
    repoName: repoNameArg,
    branchName: branchNameArg,
    isFork: true,
    private: false,
    isXlarge: true,
    repoOwner: repoOwnerArg,
    url: urlArg,
    newHead: lastCommit,
    buildSize: buildSizeArg,
    patch: patchArg
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

//extract repo name from url
function getRepoName(url) {
  let repoName = url.split("/");
  repoName = repoName[repoName.length - 1];
  repoName = repoName.replace(".git", "");
  repoName = repoName.replace("\n", "");
  return repoName;
}

//delete patch file
async function deletePatchFile(){
  console.log("called")
  return new Promise((resolve, reject) => {
    exec(`rm myPatch.patch`, function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      }

      console.log("removed the file!")
      resolve();
    });
  })
}
async function getRepoInfo() {
  return new Promise((resolve, reject) => {
    exec(`git config --get remote.origin.url`, function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      }

      const repoUrl = stdout.replace("\n", "");
      resolve(repoUrl);
    });
  });
}

async function getGitEmail() {
  return new Promise((resolve, reject) => {
    exec("git config --global user.email", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("exec error: " + error);
        reject(error);
      } else {
        resolve(stdout.replace("\n", ""));
      }
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
        if (commitarray.length == 1) {
          const firstCommit = commitarray[0];
          const lastCommit = null;
          resolve({ firstCommit, lastCommit });
        } else {
          const firstCommit = commitarray[0];
          const lastCommit = commitarray[commitarray.length - 1];
          resolve({ firstCommit, lastCommit });
        }
      }
    });
  });
}
async function getGitPatchFromLocal(){
  return new Promise((resolve, reject) => {
    exec("git diff > myPatch.patch", function(error, stdout, stderr) {
      if (error !== null) {
        console.log("error generating patch: ", error);
        reject(error);
      } else {
        fs.readFile("myPatch.patch", "utf8", function(err, data) {
          if (err) {
            console.log("error reading patch file: ", err);
            reject(err);
          }
          resolve(data);
        });
      }
    });
  })
}
async function getGitPatchFromCommits(firstCommit, lastCommit) {
  //need to delete patch file?
  return new Promise((resolve, reject) => {
    if (lastCommit === null) {
      let patchCommand = "git show HEAD > myPatch.patch";
      exec(patchCommand, function(error, stdout, stderr) {
        if (error !== null) {
          console.log("error generating patch: ", error);
          reject(error);
        } else {
          fs.readFile("myPatch.patch", "utf8", function(err, data) {
            if (err) {
              console.log("error reading patch file", err);
              reject(err);
            }
            resolve(data);
          });
        }
      });
    } else {
      let patchCommand =
        "git diff " + firstCommit + "^..." + lastCommit + " > myPatch.patch";
      exec(patchCommand, function(error, stdout, stderr) {
        if (error !== null) {
          console.log("error generating patch: ", error);
          reject(error);
        } else {
          fs.readFile("myPatch.patch", "utf8", function(err, data) {
            if (err) {
              console.log("error reading patch file ", err);
              reject(err);
            }
            resolve(data);
          });
        }
      });
    }
  });
}

async function main() {
  const buildSize = process.argv[2];
  const patchFlag = process.argv[3];


  let missingFlag = false
  if(buildSize === undefined){
    console.log('You need a build size flag("repo" or "world") in your make command')
    missingFlag = true
  }

  if(patchFlag === undefined){
    console.log('You need a patch flag("commit" or "local") in your make command')
    missingFlag = true
  }

  if(missingFlag === true){
    return
  }

  let invalidFlag = false
  console.log(buildSize !== "world")
  if(buildSize !== "world" && buildSize != "repo"){
    console.log('Invalid build size. Use "world" or "repo"')
    invalidFlag = true
  }

  if(patchFlag != "local" && patchFlag != "commit"){
    console.log('Invalid patch flag. Use "commit" to stage a build from the committed work you have locally or use "local" to stage a build from the uncommitted work you have locally')
    invalidFlag = true
  }

  if(invalidFlag === true){
    return
  }

  const userName = await getGitUser();
  const userEmail = await getGitEmail();
  const url = await getRepoInfo();
  const repoName = getRepoName(url);
  const branchName = await getBranchName();
  const newHead = "genericscsss";
  // toggle btwn create patch from commits or what you have saved locally
  if (patchFlag === "commit") {
    const { firstCommit, lastCommit } = await getGitCommits();
    const patch = await getGitPatchFromCommits(firstCommit, lastCommit);
    const payLoad = await createPayload(
      repoName,
      branchName,
      userName,
      url,
      patch,
      buildSize,
      newHead
    );
    const success = insertJob(
      payLoad,
      "Github Push: " + userName + "/" + repoName,
      userName,
      userEmail
    );
  }

  if(patchFlag === "local"){
    const patch = await getGitPatchFromLocal();
    const payLoad = await createPayload(
      repoName,
      branchName,
      userName,
      url,
      patch,
      buildSize,
      newHead
    );
    const success = insertJob(
      payLoad,
      "Github Push: " + userName + "/" + repoName,
      userName,
      userEmail
    );   

  }

  await deletePatchFile()

}

main();
