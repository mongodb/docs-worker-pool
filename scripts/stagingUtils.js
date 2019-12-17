const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");
const { MongoClient } = require("mongodb");

module.exports = {
  insertJob(payloadObj, jobTitle, jobUserName, jobUserEmail) {
    const dbName = process.env.DB_NAME;
    const collName = process.env.COL_NAME;
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
      payload: payloadObj,
      logs: {}
    };

    // we are looking for jobs in the queue with the same payload
    // that have not yet started (startTime == null)
    const filterDoc = { payload: payloadObj, startTime: null };
    const updateDoc = { $setOnInsert: newJob };

    const uri = `mongodb+srv://${username}:${secret}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, { useNewUrlParser: true });
    client.connect(err => {
      if (err) {
        console.log("error connecting to Mongo");
        return err;
      }
      const collection = client.db(dbName).collection(collName);
      collection.updateOne(filterDoc, updateDoc, { upsert: true }).then(
        result => {
          if (result.upsertedId) {
            console.log(
              "You successfully enqued a staging job to docs autobuilder. This is the record id: ",
              result.upsertedId
            );
            return true;
          }
          console.log("Already existed ", newJob);
          return "Already Existed";
        },
        error => {
          console.log(
            "There was an error enqueing a staging job to docs autobuilder. Here is the error: ",
            error
          );
          return error;
        }
      );
      client.close();
    });
  },

  createPayload(
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
      isXlarge: false,
      repoOwner: repoOwnerArg,
      url: urlArg,
      newHead: lastCommit,
      buildSize: buildSizeArg,
      patch: patchArg
    };

    return payload;
  },

  async getBranchName() {
    return new Promise((resolve, reject) => {
      exec("git rev-parse --abbrev-ref HEAD", (error, stdout) => {
        if (error !== null) {
          console.log(`exec error: ${error}`);
          reject(error);
        }
        resolve(stdout.replace("\n", ""));
      });
    });
  },

  // extract repo name from url
  getRepoName(url) {
    let repoName = url.split("/");
    repoName = repoName[repoName.length - 1];
    repoName = repoName.replace(".git", "");
    repoName = repoName.replace("\n", "");
    return repoName;
  },

  // delete patch file
  async deletePatchFile() {
    return new Promise((resolve, reject) => {
      exec("rm myPatch.patch", error => {
        if (error !== null) {
          console.log("exec error deleting patch file: ", error);
          reject(error);
        }
        resolve("successfully removed patch file");
      });
    });
  },

  async getRepoInfo() {
    return new Promise((resolve, reject) => {
      exec("git config --get remote.origin.url", (error, stdout) => {
        if (error !== null) {
          console.log(`exec error: ${error}`);
          reject(error);
        }

        const repoUrl = stdout.replace("\n", "");
        resolve(repoUrl);
      });
    });
  },

  async getGitEmail() {
    return new Promise((resolve, reject) => {
      exec("git config --global user.email", (error, stdout) => {
        if (error !== null) {
          console.log(`exec error: ${error}`);
          reject(error);
        } else {
          resolve(stdout.replace("\n", ""));
        }
      });
    });
  },

  async getGitUser() {
    return new Promise((resolve, reject) => {
      exec("git config --global user.name", (error, stdout) => {
        if (error !== null) {
          console.log(`exec error: ${error}`);
          reject(error);
        } else {
          resolve(stdout.replace("\n", ""));
        }
      });
    });
  },

  async getGitCommits() {
    return new Promise((resolve, reject) => {
      exec("git cherry", (error, stdout) => {
        if (error !== null) {
          console.log(`exec error: ${error}`);
          reject(error);
        } else {
          const cleanedup = stdout.replace(/\+ /g, "");
          const commitarray = cleanedup.split(/\r\n|\r|\n/);
          commitarray.pop(); // remove the last, dummy element that results from splitting on newline
          if (commitarray.length === 0) {
            console.log(
              "You have tried to create a staging job from local commits but you have no committed work. Please make commits and then try again"
            );
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
  },

  async getUpstreamBranch(branchName) {
    return new Promise((resolve, reject) => {
      try {
        exec(
          `git rev-parse --abbrev-ref --symbolic-full-name ${branchName}@{upstream}`,
          error => {
            if (error === null) {
              resolve(data);
              return true;
            } else {
              if (error.code === 128) {
                console.log(
                  'You have not set an upstream for your local branch. Please do so with this command:','\n\n', 'git branch -u origin',
                  '\n\n');
              } else {
                console.log('error finding upstream for local branch: ', error);
              }
            }
          }
        );
      } catch (error) {
        reject(error);
        return false;
      }
    });
  },
  async getGitPatchFromLocal(branchName) {
    return new Promise((resolve, reject) => {
      exec(
        `git diff origin/${branchName} --ignore-submodules > myPatch.patch`,
        error => {
          if (error !== null) {
            console.log("error generating patch: ", error);
            reject(error);
          } else {
            fs.readFile("myPatch.patch", "utf8", (err, data) => {
              if (err) {
                console.log("error reading patch file: ", err);
                reject(err);
              }
              resolve(data);
            });
          }
        }
      );
    });
  },
  async getGitPatchFromCommits(firstCommit, lastCommit) {
    //need to delete patch file?
    return new Promise((resolve, reject) => {
      if (lastCommit === null) {
        const patchCommand = "git show HEAD > myPatch.patch";
        exec(patchCommand, error => {
          if (error !== null) {
            console.log("error generating patch: ", error);
            reject(error);
          } else {
            fs.readFile("myPatch.patch", "utf8", (err, data) => {
              if (err) {
                console.log("error reading patch file", err);
                reject(err);
              }
              resolve(data);
            });
          }
        });
      } else {
        const patchCommand = `git diff ${firstCommit}^...${lastCommit} > myPatch.patch`;
        exec(patchCommand, error => {
          if (error !== null) {
            console.log("error generating patch: ", error);
            reject(error);
          } else {
            fs.readFile("myPatch.patch", "utf8", (err, data) => {
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
  },

  validateConfiguration() {
    const missingConfigs = [];

    if (process.env.DB_NAME === undefined || process.env.DB_NAME === "") {
      missingConfigs.push("DB_NAME");
    }
    if (process.env.COL_NAME === undefined || process.env.COL_NAME === "") {
      missingConfigs.push("COL_NAME");
    }
    if (process.env.USERNAME === undefined || process.env.USERNAME === "") {
      missingConfigs.push("USERNAME");
    }
    if (process.env.SECRET === undefined || process.env.SECRET === "") {
      missingConfigs.push("SECRET");
    }
    if (missingConfigs.length !== 0) {
      console.log(missingConfigs);
      console.log(
        `The ~/.config/.snootyenv file is found but does not contain the following required fields: ${missingConfigs.toString()}`
      );
      process.exit();
    }
  }
};
