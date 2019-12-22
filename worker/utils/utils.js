// Imports
const path = require('path');
const fs = require('fs-extra');
const request = require('request');
const yaml = require('js-yaml');
// const git  = require('nodegit');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const mongo = require('./mongo');
const crypto = require('crypto');

module.exports = {
  // Outputs a list of all of the files in the directory (base) with the given extension (ext)
  getFilesInDir(base, ext = '', files, result) {
    let resultInternal;
    if (fs.existsSync(base)) {
      const filesInternal = files || fs.readdirSync(base);
      resultInternal = result || [];
      filesInternal.forEach(file => {
        const newbase = path.join(base, file);
        if (fs.statSync(newbase).isDirectory()) {
          resultInternal = module.exports.getFilesInDir(
            newbase,
            ext,
            fs.readdirSync(newbase),
            resultInternal
          );
        } else if (
          ext === '' ||
          file.substr(-1 * (ext.length + 1)) === `.${ext}`
        ) {
          resultInternal.push(newbase);
        }
      });
    }
    return resultInternal;
  },

  async fileExists(dir) {
    return fs.existsSync('./' + dir);
  },

  rootFileExists(dir) {
    return fs.existsSync(dir);
  },

  writeToFile(fileName, text) {
    fs.outputFile(fileName, text, function(err) {
      console.log(err); //null
    });
  },

  async encryptJob(salt, string1, string2) {
    const secret = this.retrievePassword() + string1 + string2;
    const digest = crypto.scryptSync(secret, salt, 64);
    return digest.toString('hex');
  },

  async validateJob(digest, salt, string1, string2) {
    this.encryptJob(salt, string1, string2).then(function(value) {
      const bufferDigest2 = Buffer.from(value, 'utf8');
      const bufferDigest1 = Buffer.from(digest, 'utf8');
      crypto.timingSafeEqual(bufferDigest1, bufferDigest2);
    });
  },

  generateSalt() {
    return crypto.randomBytes(16).toString('base64');
  },
  retrievePassword() {
    return process.env.crypto_secret;
  },
  printFile(fileName) {
    fs.readFile(fileName, function(err, data) {
      /* If an error exists, show it, otherwise show the file */
      err ? Function('error', 'throw error')(err) : console.log(data);
    });
  },

  async removeDirectory(dir) {
    if (fs.existsSync('./' + dir)) {
      await fs.removeSync('./' + dir);
    }
    return true;
  },

  async resetDirectory(dir) {
    await fs.removeSync(dir);
    await fs.mkdirsSync(dir);
  },

  async touchFile(file) {
    await fs.closeSync(fs.openSync(file, 'w'));
  },

  async validateUrl(url) {
    const request = require('request');
    request.get(url, function(err, res) {
      if (res != null) {
        return res.status != 404;
      }
    });
    return false;
  },

  // Function for testing that resolves in n seconds
  async resolveAfterNSeconds(n) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, 1000 * n);
    });
  },

  // Function that rejects function (promise) after (seconds) seconds with error (errMsg)
  promiseTimeoutS(seconds, promise, errMsg) {
    // Create a promise that rejects in <seconds> seconds
    const timeout = new Promise((resolve, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`${errMsg} --> Timed out in ${seconds} seconds.`));
      }, 1000 * seconds);
    });

    // Returns a race between our timeout and the passed in promise
    return Promise.race([promise, timeout]);
  },

  // Return promisified version of exec() function
  getExecPromise() {
    return exec;
  },

  // Adds log message (message) to current job in queue at spot (currentJob.numFailures)
  async logInMongo(currentJob, message) {
    await mongo.logMessageInMongo(currentJob, message);
  },

  async populateCommunicationMessageInMongo(currentJob, message) {
    await mongo.populateCommunicationMessageInMongo(currentJob, message);
  },

  async getAllRepos() {
    return mongo
      .getMetaCollection()
      .find({})
      .toArray();
  },

  async getRepoPublishedBranches(repoObject) {
    const pubBranchesFile = `https://raw.githubusercontent.com/${repoObject.repoOwner}/${repoObject.repoName}/meta/published-branches.yaml`;
    const returnObject = {};
    return new Promise(function(resolve, reject) {
      request(pubBranchesFile, function(error, response, body) {
        if (!error && body && response.statusCode === 200) {
          try {
            const yamlParsed = yaml.safeLoad(body);
            returnObject['status'] = 'success';
            returnObject['content'] = yamlParsed;
          } catch (e) {
            console.log('ERROR parsing yaml file!', repoObject, e);
            returnObject['status'] = 'failure';
            reject(error);
          }
        } else {
          returnObject['status'] = 'failure';
          returnObject['content'] = response;
        }
        resolve(returnObject);
      });
    });
  }
};
