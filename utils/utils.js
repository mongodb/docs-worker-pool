// Imports
const path = require('path');
const aws  = require('aws-sdk');
const fs   = require('fs-extra');
const git  = require("nodegit");
const { promisify } = require('util');

// Get and Set Github Credentials
const githubUser     = encodeURIComponent(process.env.GITHUB_USERNAME);
const githubPassword = encodeURIComponent(process.env.GITHUB_PASSWORD);

// Get and Set AWS Credentials
aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new aws.S3();

module.exports = {
	getFilesInDir : function(base,ext,files,result) {
		files = files || fs.readdirSync(base) 
		result = result || [] 
		files.forEach( 
			function (file) {
				var newbase = path.join(base,file)
				if ( fs.statSync(newbase).isDirectory() ) {
					result = module.exports.getFilesInDir(newbase,ext,fs.readdirSync(newbase),result)
				} else {
					if ( ext === "" || file.substr(-1*(ext.length+1)) == '.' + ext ) {
						result.push(newbase)
					} 
				}
			}
		)
		return result
	},  

	s3PutObject : async function(params) {
		// return s3.putObject(params).promise();
	},

	uploadFileToS3Bucket : async function(filePath, bucketName) {
		console.log("Uploading ", filePath, " to S3 bucket ", bucketName);
		var params = {
		  	Bucket: bucketName,
		  	Body : fs.createReadStream(filePath),
		  	Key : "folder/" + Date.now() + "_" + path.basename(filePath), 
		  	ACL: 'public-read',
		};
		return this.s3PutObject(params);
	},

	uploadDirectoryToS3Bucket : async function(dirPath, bucketName) {
		console.log("    (AWS)".padEnd(15) + "Uploading Directory (", dirPath, ") to S3 Bucket: ", bucketName);
		var files = module.exports.getFilesInDir(dirPath, "");
		console.log("    (AWS)".padEnd(15) + "Uploaded Files: ", files);
		const promiseArray = files.map(
			file => this.uploadFileToS3Bucket(file, bucketName)
		); 
		return Promise.all(promiseArray);
	},

	resetDirectory : async function(dir) {
		fs.removeSync(dir); 
		fs.mkdirsSync(dir);
		console.log("    (DIR)".padEnd(15) + "Successfully Reset Directory: " + dir);
	},

	// cloneGitRepository : async function(repository, dir) {
	// 	console.log("    (GIT)".padEnd(15) + "Starting to Clone Git Repository: ", repository);
	// 	await git.Clone(repository, dir);
	// 	// await git("work").silent(false).clone(repository);
	// 	console.log("    (GIT)".padEnd(15) + "Successfully Cloned Repository: ", repository);
	// },

	resolveAfterNSeconds : async function(n) {
		return new Promise(resolve => {
		  setTimeout(() => { resolve(); }, 1000 * n);
		});
	}, 

	promiseTimeoutS : function(seconds, promise, errMsg){
		// Create a promise that rejects in <seconds> seconds
		let timeout = new Promise((resolve, reject) => {
		  	let id = setTimeout(() => {
				clearTimeout(id);
				reject(errMsg + ' --> Timed out in '+ seconds + ' seconds.')}, 1000 * seconds)
			})
	  
		// Returns a race between our timeout and the passed in promise
		return Promise.race([promise, timeout])
	}, 

	retry : async function(fn, retriesLeft = 5, interval = 1000) {
		try {
			console.log("trying")
			const val = await fn();
			return val;
		} catch (error) {
			console.log("catching")
		  	if (retriesLeft) {
				await new Promise(r => setTimeout(r, interval));
				return module.exports.retry(fn, retriesLeft - 1, interval);
		  	} else {
				console.log("HU")
				throw new Error('Max retries reached with err: ' + error);
			}
		}
	},
	  

}