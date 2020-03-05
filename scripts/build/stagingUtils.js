/* eslint-disable prefer-destructuring */
/* eslint-disable no-plusplus */
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fs = require('fs');
const { MongoClient } = require('mongodb');

module.exports = {
  async insertJob(payloadObj, jobTitle, jobUserName, jobUserEmail) {
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

    const filterDoc = {
      payload: payloadObj,
      status: { $in: ['inProgress', 'inQueue'] },
    };
    const updateDoc = { $setOnInsert: newJob };

    const uri = `mongodb+srv://${username}:${secret}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
    // connect to your cluster
    const client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // specify the DB's name
    const collection = client.db(dbName).collection(collName);

    // execute update query
    try {
      const result = await collection.updateOne(filterDoc, updateDoc, {
        upsert: true,
      });

      if (result.upsertedId) {
        console.log(
          `You successfully enqued a staging job to docs autobuilder. This is the record id: ${result.upsertedId._id}`
        );
        client.close();
        return true;
      }
      client.close();
      console.log('This job already exists ');
      return 'Already Existed';
    } catch (error) {
      console.error(
        `There was an error enqueing a staging job to docs autobuilder. Here is the error: ${error}`
      );
      client.close();
      return error;
    }
  },

  createPayload(
    repoNameArg,
    upstreamBranchName,
    upstreamConfig,
    repoOwnerArg,
    urlArg,
    patchArg,
    buildSizeArg,
    lastCommit,
    localBranchArg,
    visibility,
  ) {
    const payload = {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName: repoNameArg,
      branchName: upstreamBranchName,
      upstream: upstreamConfig,
      localBranchName: localBranchArg,
      isFork: true,
      private: visibility,
      isXlarge: true,
      repoOwner: repoOwnerArg,
      url: urlArg,
      newHead: lastCommit,
      patch: patchArg,
    };

    return payload;
  },

  async getBranchName() {
    return new Promise((resolve) => {
      exec('git rev-parse --abbrev-ref HEAD')
        .then((result) => {
          resolve(result.stdout.replace('\n', ''));
        })
        .catch(console.error);
    });
  },

  // extract repo name from url
  getRepoName(url) {
    if (url === undefined) {
      console.error('getRepoName error: repository url is undefined');
    }
    let repoName = url.split('/');
    repoName = repoName[repoName.length - 1];
    repoName = repoName.replace('.git', '');
    repoName = repoName.replace('\n', '');
    return repoName;
  },

  // delete patch file
  async deletePatchFile() {
    return new Promise((resolve, reject) => {
      exec('rm myPatch.patch')
        .then(() => {
          resolve('successfully removed patch file');
        })
        .catch((error) => {
          console.error(`exec error deleting patch file: ${error}`);
          reject(error);
        });
    });
  },

  async getRepoInfo() {
    return new Promise((resolve, reject) => {
      exec('git config --get remote.origin.url')
        .then((result) => {
          const repoUrl = result.stdout.replace('\n', '');
          resolve(repoUrl);
        })
        .catch((error) => {
          console.error(`exec error: ${error}`);
          reject(error);
        });
    });
  },

  async getGitEmail() {
    return new Promise((resolve, reject) => {
      exec('git config --global user.email')
        .then((result) => {
          resolve(result.stdout.replace('\n', ''));
        })
        .catch((error) => {
          console.error(`exec error: ${error}`);
          reject(error);
        });
    });
  },

  getGitUser(url) {
    let repoOwner = url.split('/');
    repoOwner = repoOwner[repoOwner.length - 2];
    repoOwner = repoOwner.replace('git@github.com:', '');
    return repoOwner;
  },

  async getGitCommits() {
    return new Promise((resolve, reject) => {
      exec('git cherry')
        .then((result) => {
          const cleanedup = result.stdout.replace(/\+ /g, '');
          const commitarray = cleanedup.split(/\r\n|\r|\n/);
          commitarray.pop();// remove the last, dummy element that results from splitting on newline
          if (commitarray.length === 0) {
            const err = 'You have tried to create a staging job from local commits but you have no committed work. Please make commits and then try again';
            reject(err);
          }
          if (commitarray.length === 1) {
            const firstCommit = commitarray[0];
            const lastCommit = null;
            resolve([firstCommit, lastCommit]);
          }
          const firstCommit = commitarray[0];
          const lastCommit = commitarray[commitarray.length - 1];
          resolve([firstCommit, lastCommit]);
        })
        .catch((error) => {
          console.error('error generating patch: ', error);
          reject(error);
        });
    });
  },

  async getUpstreamRepo() {
    try {
      const forkConfig = (await exec('git remote get-url upstream')).stdout;
      const upstreamRepo = (forkConfig.replace('git@github.com:', ''));
      return upstreamRepo;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async checkIfPrivateRepo(url) {
    let cleanedURL = url.replace('.git', '');
    cleanedURL = cleanedURL.replace(/\r?\n|\r/g, '');
    return new Promise((resolve, reject) => {
      exec(`curl ${cleanedURL} --head > visibility.txt`)
        .then(() => {
          fs.readFile('visibility.txt', 'utf8', (err, data) => {
            if (err) {
              return reject(err);
            }
            if (data.includes('HTTP/1.1 200 OK')) {
              return resolve(true);
            }
            return resolve(false);
          });
        })
        .catch((error) => reject(error));
    });
  },

  async checkUpstreamConfiguration(localBranchName) {
    try {
      const result = await exec(
        `git rev-parse --abbrev-ref --symbolic-full-name ${localBranchName}@{upstream}`
      );

      return result.stdout;
    } catch (error) {
      if (error.code === 128) {
        const errormsg = "You have not set an upstream for your local branch. Please do so with this command: \
         \n\n \
          git branch -u <upstream-branch-name>\
          \n\n";
        console.error(errormsg);
        throw errormsg;
      }
      console.error(error);
      throw error;
    }
  },

  async getGitPatchFromLocal(upstreamBranchName) {
    return new Promise((resolve, reject) => {
      exec(`git diff ${upstreamBranchName} --ignore-submodules > myPatch.patch`)
        .then(() => {
          fs.readFile('myPatch.patch', 'utf8', (err, data) => {
            if (err) {
              console.log('error reading patch file: ', err);
              reject(err);
            }
            resolve(data);
          });
        })
        .catch((error) => {
          console.error('error generating patch: ', error);
          reject(error);
        });
    });
  },
  async getGitPatchFromCommits(firstCommit, lastCommit) {
    // need to delete patch file?
    return new Promise((resolve, reject) => {
      if (lastCommit === null) {
        const patchCommand = 'git show HEAD > myPatch.patch';
        exec(patchCommand)
          .then(() => {
            fs.readFile('myPatch.patch', 'utf8', (err, data) => {
              if (err) {
                console.error('error reading patch file: ', err);
                reject(err);
              }
              resolve(data);
            });
          })
          .catch((error) => {
            console.error('error generating patch: ', error);
            reject(error);
          });
      } else {
        const patchCommand = `git diff ${firstCommit}^...${lastCommit} > myPatch.patch`;
        exec(patchCommand)
          .then(() => {
            fs.readFile('myPatch.patch', 'utf8', (err, data) => {
              if (err) {
                console.error('error reading patch file: ', err);
                reject(err);
              }
              resolve(data);
            });
          })
          .catch((error) => {
            console.error('error generating patch: ', error);
            reject(error);
          });
      }
    });
  },

  validateConfiguration() {
    const missingConfigs = [];

    if (process.env.DB_NAME === undefined || process.env.DB_NAME === '') {
      missingConfigs.push('DB_NAME');
    }
    if (process.env.COL_NAME === undefined || process.env.COL_NAME === '') {
      missingConfigs.push('COL_NAME');
    }
    if (process.env.USERNAME === undefined || process.env.USERNAME === '') {
      missingConfigs.push('USERNAME');
    }
    if (process.env.SECRET === undefined || process.env.SECRET === '') {
      missingConfigs.push('SECRET');
    }
    if (missingConfigs.length !== 0) {
      const err = new Error(
        `The ~/.config/.snootyenv file is found but does not contain the following required fields: ${missingConfigs.toString()}`
      );
      console.error(err);
      throw err;
    }
  }
};
