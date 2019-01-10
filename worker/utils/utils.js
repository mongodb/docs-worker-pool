// Imports
const path = require('path');
const aws  = require('aws-sdk');
const fs   = require('fs-extra');
const mongo   = require('./mongo');
// const git  = require("nodegit");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);


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
	/***********************************************************************************
	 *  							 FileSystem Utilities   						   *
	 ***********************************************************************************/
	getFilesInDir : function(base,ext = "",files,result) {
		if (fs.existsSync(base)) {
			files = files || fs.readdirSync(base) 
			result = result || [] 
			files.forEach( 
				function (file) {
					var newbase = path.join(base,file)
					if ( fs.statSync(newbase).isDirectory() ) {
						result = module.exports.getFilesInDir(newbase,ext,fs.readdirSync(newbase),result)
					} else if ( ext === "" || file.substr(-1*(ext.length+1)) == '.' + ext ) {
						result.push(newbase) 
					}
				}
			)
		};
		return result;
	},  

	resetDirectory : async function(dir) {
		fs.removeSync(dir); 
		fs.mkdirsSync(dir);
	},

	/***********************************************************************************
	 *  							    AWS S3 Utilities    						   *
	 ***********************************************************************************/
	s3PutObject : async function(params) {
		// return s3.putObject(params).promise();
	},

	uploadFileToS3Bucket : async function(filePath, bucketName) {
		//console.log("Uploading ", filePath, " to S3 bucket ", bucketName);
		var params = {
		  	Bucket: bucketName,
		  	Body : fs.createReadStream(filePath),
		  	Key : "folder/" + Date.now() + "_" + path.basename(filePath), 
		  	ACL: 'public-read',
		};
		return module.exports.s3PutObject(params);
	},

	uploadDirectoryToS3Bucket : async function(currentJob, dirPath, bucketName) {
		let logMsg = "    (AWS)".padEnd(15) + "Uploading Directory (" + dirPath + ") to S3 Bucket: " + bucketName;
		module.exports.logInMongo(currentJob, logMsg);

		var files = module.exports.getFilesInDir(dirPath, "");
		const promiseArray = files.map(
			file => this.uploadFileToS3Bucket(file, bucketName)
		);

		logMsg = "    (AWS)".padEnd(15) + "Uploaded Files: " + files;
		module.exports.logInMongo(currentJob, logMsg);

		return Promise.all(promiseArray);
	},

	// cloneGitRepository : async function(repository, dir) {
	// 	console.log("    (GIT)".padEnd(15) + "Starting to Clone Git Repository: ", repository);
	// 	await git.Clone(repository, dir);
	// 	console.log("    (GIT)".padEnd(15) + "Successfully Cloned Repository: ", repository);
	// },

	/***********************************************************************************
	 *  							    Async Utilities    			  	   		       *
	 ***********************************************************************************/
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
	
	/***********************************************************************************
	 *  							    Exec Utilities    			  	   		       *
	 ***********************************************************************************/
	getExecPromise : function() {
		return exec;
	},

	/***********************************************************************************
	 *   logInMongo() --> adds log message to the job in the queue                     *
	 ***********************************************************************************/
	logInMongo : async function(currentJob, message) {
		console.log(message);
		await mongo.logMessageInMongo(currentJob, message);
	}, 

	/***********************************************************************************
	 *   cloneObject() --> performs a deep copy of an object                           *
	 ***********************************************************************************/
	cloneObject: function(obj) {
		if (!obj) { return obj; }
		var clone = {};
		for(var i in obj) {
			if(obj[i] != null &&  typeof(obj[i])=="object")
				clone[i] = module.exports.cloneObject(obj[i]);
			else
				clone[i] = obj[i];
		}
		return clone;
	}
}