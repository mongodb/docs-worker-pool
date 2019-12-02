const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fs = require('fs');
const { MongoClient } = require('mongodb');

function insertJob(payloadObj, jobTitle, jobUserName, jobUserEmail) {
  const dbName = process.env.DB_NAME;
  const collName = process.env.COL_NAME;
  const username = process.env.USERNAME;
  const secret = process.env.SECRET;
  // create the new job document
  const newJob = {
    title: jobTitle,
    user: jobUserName,
    email: jobUserEmail,
    status: 'inQueue',
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    numFailures: 0,
    failures: [],
    result: null,
    payload: payloadObj,
    logs: {},
  };

  // we are looking for jobs in the queue with the same payload that have not yet started (startTime == null)
  const filterDoc = { payload: payloadObj, startTime: null };
  const updateDoc = { $setOnInsert: newJob };

  const uri = `mongodb+srv://${username}:${secret}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, { useNewUrlParser: true });
  client.connect((err) => {
    if (err) {
      console.log('error!');
      return;
    }
    const collection = client.db(dbName).collection(collName);
    collection.updateOne(filterDoc, updateDoc, { upsert: true }).then(
      (result) => {
        if (result.upsertedId) {
          console.log('You successfully enqued a staging job to docs autobuilder. This is the record id: ', result.upsertedId);
          return result.upsertedId;
        }
        console.log('Already existed ', newJob)
        return 'Already Existed';
      },
      ((error) => {
        console.log('There was an error enqueing a staging job to docs autobuilder. Here is the error: ', error);
        return error;
      }
      ),
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
  lastCommit,
) {
  const payload = {
    jobType: 'githubPush',
    source: 'github',
    action: 'push',
    repoName: repoNameArg,
    branchName: branchNameArg,
    isFork: true,
    private: false,
    isXlarge: false,
    repoOwner: repoOwnerArg,
    url: urlArg,
    newHead: lastCommit,
    buildSize: buildSizeArg,
    patch: patchArg,
  };

  return payload;
}

async function getBranchName() {
  return new Promise((resolve, reject) => {
    exec('git rev-parse --abbrev-ref HEAD', (error, stdout) => {
      if (error !== null) {
        console.log(`exec error: ${error}`);
        reject(error);
      }
      resolve(stdout.replace('\n', ''));
    });
  });
}

//extract repo name from url
function getRepoName(url) {
  let repoName = url.split('/');
  repoName = repoName[repoName.length - 1];
  repoName = repoName.replace('.git', '');
  repoName = repoName.replace('\n', '');
  return repoName;
}

//delete patch file

async function deletePatchFile() {
  return new Promise((resolve, reject) => {
    exec('rm myPatch.patch', (error) => {
      if (error !== null) {
        console.log('exec error deleting patch file: ', error);
        reject(error);
      }
      resolve();
    });
  })
}
async function getRepoInfo() {
  return new Promise((resolve, reject) => {
    exec('git config --get remote.origin.url', (error, stdout) => {
      if (error !== null) {
        console.log(`exec error: ${error}`);
        reject(error);
      }

      const repoUrl = stdout.replace('\n', '');
      resolve(repoUrl);
    });
  });
}

async function getGitEmail() {
  return new Promise((resolve, reject) => {
    exec('git config --global user.email', (error, stdout) => {
      if (error !== null) {
        console.log(`exec error: ${error}`);
        reject(error);
      } else {
        resolve(stdout.replace('\n', ''));
      }
    });
  });
}

async function getGitUser() {
  return new Promise((resolve, reject) => {
    exec('git config --global user.name', (error, stdout) => {
      if (error !== null) {
        console.log(`exec error: ${error}`);
        reject(error);
      } else {
        resolve(stdout.replace('\n', ''));
      }
    });
  });
}

async function getGitCommits() {
  return new Promise((resolve, reject) => {
    exec('git cherry', (error, stdout) => {
      if (error !== null) {
        console.log(`exec error: ${error}`);
        reject(error);
      } else {
        const cleanedup = stdout.replace(/\+ /g, '');
        const commitarray = cleanedup.split(/\r\n|\r|\n/);
        commitarray.pop(); //remove the last, dummy element that results from splitting on newline
        if (commitarray.length === 0) {
          console.log('You have tried to create a staging job from local commits but you have no committed work. Please make commits and then try again');
          reject();
        }
        if (commitarray.length === 1) {
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
async function getGitPatchFromLocal(branchName) {
  return new Promise((resolve, reject) => {
    exec(`git diff origin/${branchName} > myPatch.patch`, (error) => {
      if (error !== null) {
        console.log('error generating patch: ', error);
        reject(error);
      } else {
        fs.readFile('myPatch.patch', 'utf8', (err, data) => {
          if (err) {
            console.log('error reading patch file: ', err);
            reject(err);
          }
          resolve(data);
        });
      }
    });
  });
}
async function getGitPatchFromCommits(firstCommit, lastCommit) {
  //need to delete patch file?
  return new Promise((resolve, reject) => {
    if (lastCommit === null) {
      const patchCommand = 'git show HEAD > myPatch.patch';
      exec(patchCommand, (error) => {
        if (error !== null) {
          console.log('error generating patch: ', error);
          reject(error);
        } else {
          fs.readFile('myPatch.patch', 'utf8', (err, data) => {
            if (err) {
              console.log('error reading patch file', err);
              reject(err);
            }
            resolve(data);
          });
        }
      });
    } else {
      const patchCommand =  "git diff " + firstCommit + "^..." + lastCommit + " > myPatch.patch";
      exec(patchCommand, (error) => {
        if (error !== null) {
          console.log('error generating patch: ', error);
          reject(error);
        } else {
          fs.readFile('myPatch.patch', 'utf8', (err, data) => {
            if (err) {
              console.log('error reading patch file ', err);
              reject(err);
            }
            resolve(data);
          });
        }
      });
    }
  });
}

function validateConfiguration() {
  const missingConfigs = [];

  if (process.env.DB_NAME === undefined || process.env.DB_NAME === '') {
    console.log(process.env.DB_NAME )
    missingConfigs.push('DB_NAME');
  }
  if (process.env.COL_NAME === undefined || process.env.COL_NAME === '') {
    console.log(process.env.COL_NAME);
    missingConfigs.push('COL_NAME');
  }
  if (process.env.USERNAME === undefined || process.env.USERNAME === '') {
    missingConfigs.push('USERNAME');
  }
  if (process.env.SECRET === undefined || process.env.SECRET === '') {
    console.log(process.env.SECRET);
    missingConfigs.push('SECRET');
  }
  if (missingConfigs.length !== 0) {
    console.log(`The .env file is found but does not contain the following required fields: ${missingConfigs.toString()}`);
  }
}

async function main() {
  const patchFlag = process.argv[2];
  const buildSize = process.argv[3];

  validateConfiguration();

  let missingFlag = false;
  if (patchFlag === undefined) {
    console.log('You need a patch flag("commit" or "local") in your make command');
    return;
  }

  let invalidFlag = false;

  if (buildSize!== undefined && buildSize !== 'world' && buildSize !== 'repo') {
    console.log('Invalid build size. Use "world" or "repo"');
    invalidFlag = true;
  }

  if (patchFlag !== 'local' && patchFlag !== 'commit') {
    console.log('Invalid patch flag. Use "commit" to stage a build from the committed work you have locally or use "local" to stage a build from the uncommitted work you have locally');
    invalidFlag = true;
  }

  if (invalidFlag === true) {
    return;
  }

  const userName = await getGitUser();
  const userEmail = await getGitEmail();
  const url = await getRepoInfo();
  const repoName = getRepoName(url);
  const branchName = await getBranchName();
  const newHead = 'genericscsss';
  // toggle btwn create patch from commits or what you have saved locally
  if (patchFlag === 'commit') {
    const { firstCommit, lastCommit } = await getGitCommits();
    const patch = await getGitPatchFromCommits(firstCommit, lastCommit);
    const payLoad = await createPayload(
      repoName,
      branchName,
      userName,
      url,
      patch,
      buildSize,
      newHead,
    );
    insertJob(
      payLoad,
      `Github Push: ${userName}/repoName`,
      userName,
      userEmail,
    );
  }

  if (patchFlag === 'local') {
    const patch = await getGitPatchFromLocal(branchName);
    const payLoad = await createPayload(
      repoName,
      branchName,
      userName,
      url,
      patch,
      buildSize,
      newHead,
    );
    insertJob(
      payLoad,
      `Github Push: ${userName}/repoName`,
      userName,
      userEmail,
    );
  }

  await deletePatchFile();
}

main();
