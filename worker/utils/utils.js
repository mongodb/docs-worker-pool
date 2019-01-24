

// Imports
const path = require('path');
const aws = require('aws-sdk');
const fs = require('fs-extra');
// const git  = require("nodegit");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const mongo = require('./mongo');

// Get and Set Github Credentials
// const githubUser = encodeURIComponent(process.env.GITHUB_USERNAME);
// const githubPassword = encodeURIComponent(process.env.GITHUB_PASSWORD);

// Get and Set AWS Credentials
aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const s3 = new aws.S3();

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

    async resetDirectory(dir) {
        fs.removeSync(dir);
        fs.mkdirsSync(dir);
    },

    // Returns promisified version of s3.putObject()
    // Needs its own function for testing purposes
    async s3PutObject(params) {
        return s3.putObject(params).promise();
    },

    // Uploads file at filePath to bucket with bucketName
    async uploadFileToS3Bucket(filePath, bucketName) {
        // console.log("Uploading ", filePath, " to S3 bucket ", bucketName);
        const params = {
            Bucket: bucketName,
            Body: fs.createReadStream(filePath),
            // NOT SURE WHAT THE KEY NEEDS TO BE!
            Key: `folder/${path.basename(filePath)}`,
            ACL: 'public-read',
        };
        return module.exports.s3PutObject(params);
    },

    // Uploads entire directory (dirPath) to bucket with name (bucketName)
    async uploadDirectoryToS3Bucket(currentJob, dirPath, bucketName) {
        let logMsg = `${'    (AWS)'.padEnd(15)}Uploading Directory (${dirPath}) to S3 Bucket: ${bucketName}`;
        module.exports.logInMongo(currentJob, logMsg);

        const files = module.exports.getFilesInDir(dirPath, '');
        const promiseArray = files.map(
            file => this.uploadFileToS3Bucket(file, bucketName),
        );

        logMsg = `${'    (AWS)'.padEnd(15)}Uploaded Files: ${files}`;
        module.exports.logInMongo(currentJob, logMsg);

        return Promise.all(promiseArray);
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

    // Return promisified version of exec() function - for testing purposes
    getExecPromise() {
        return exec;
    },

    // Adds log message (message) to current job in queue at spot (currentJob.numFailures)
    async logInMongo(currentJob, message) {
        console.log(message);
        await mongo.logMessageInMongo(currentJob, message);
    },
};
