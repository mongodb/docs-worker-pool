// Imports
const path = require('path');
const fs = require('fs-extra');
const request = require('request');
const yaml = require('js-yaml');
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
    console.log(`running validation for url ${url}`);
    const request = require('request');
    request.get(url, function (err, res) {
      if (err) {
        console.log('error getting url');
        return false;
      }
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
  
  // save array of purged URLs to job object
  async updateJobWithPurgedURLs(currentJob, urlArray) {
    await mongo.updateJobWithPurgedURLs(currentJob, urlArray);
  },

  // Adds log message (message) to current job in queue at spot (currentJob.numFailures)
  async logInMongo(currentJob, message) {
    await mongo.logMessageInMongo(currentJob, message);
  },

  async populateCommunicationMessageInMongo(currentJob, message) {
    await mongo.populateCommunicationMessageInMongo(currentJob, message);
  },

  async getAllRepos() {
    return mongo.getMetaCollection().find({}).toArray();
  },

  //either xlarge workerpool or regular
  async getServerUser(){
    try {
      const {
        stdout,
        stderr
      } = await exec(`whoami`); 
      return stdout.trim()
    } catch (error) {
      console.log('Error running shell command whoami', error)
      throw error
    }
  },

  // gets entitlements for user when deploying
  // similar to the `getUserEntitlements` function on stitch
  async getUserEntitlements(githubUsername) {
    const returnObject = { status: 'failure' };
    const entitlementsCollection = mongo.getEntitlementsCollection();
    if (entitlementsCollection) {
      const query = { 'github_username': githubUsername };
      const entitlementsObject = await entitlementsCollection.findOne(query);
      // if user has specific entitlements
      if (entitlementsObject && entitlementsObject.repos && entitlementsObject.repos.length > 0) {
        returnObject.repos = entitlementsObject.repos;
        returnObject.github_username = entitlementsObject.github_username;
        returnObject.status = 'success';
      }
    }
    return returnObject;
  },
  
  async getSnootyProjectName(repoDirName){
    try {
      const commands = [
        `. /venv/bin/activate`,
        `cd ~/repos/${repoDirName}`,
        `make get-project-name`
      ]

      const { stdout, stderr } = await exec(commands.join(' && '));
      // etc etc
      console.log(stdout)
      return stdout.trim();

    }
    catch (error) {
      console.log('Error running command', error)
      throw error
      //catch errors
    }

  },

  async getRepoPublishedBranches(repoObject) {
    const pubBranchesFile = `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/publishedbranches/${repoObject.repoName}.yaml`;
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
