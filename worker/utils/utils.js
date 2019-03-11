

// Imports
const path = require('path');
const fs = require('fs-extra');
// const git  = require("nodegit");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const mongo = require('./mongo');


module.exports = {

    // Outputs a list of all of the files in the directory (base) with the given extension (ext)
    getFilesInDir(base, ext = '', files, result) {
        let resultInternal;
        if (fs.existsSync(base)) {
            const filesInternal = files || fs.readdirSync(base);
            resultInternal = result || [];
            filesInternal.forEach(
                (file) => {
                    const newbase = path.join(base, file);
                    if (fs.statSync(newbase).isDirectory()) {
                        resultInternal = module.exports.getFilesInDir(
                            newbase, ext, fs.readdirSync(newbase), resultInternal,
                        );
                    } else if (ext === '' || file.substr(-1 * (ext.length + 1)) === `.${ext}`) {
                        resultInternal.push(newbase);
                    }
                },
            );
        }
        return resultInternal;
    },

    async fileExists(dir) {
        return (fs.existsSync('./' + dir));
    },

    async removeDirectory(dir) {
        //check for safety
        if (!dir.startsWith('docs')) {
            throw Error('directory not verified');
        }
        
        if (fs.existsSync('./' + dir)) {
            await fs.removeSync('./' + dir)
        }
        return true;
    },

    async resetDirectory(dir) {
        fs.removeSync(dir);
        fs.mkdirsSync(dir);
    },

    // Function for testing that resolves in n seconds
    async resolveAfterNSeconds(n) {
        return new Promise((resolve) => {
            setTimeout(() => { resolve(); }, 1000 * n);
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
    }
};
