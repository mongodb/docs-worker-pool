const workerUtils = require('../utils/utils');
const fs   = require('fs-extra');
const util = require('util');


const gitCloneTimeout = 20;
const gatsbyBuildTimeout = 60 * 45;
const uploadToS3Timeout = 20;

module.exports = {

	gatsbyBuild : async function(currentJob) {
		workerUtils.logInMongo(currentJob, "    (GATSBY)".padEnd(15) + "Running Gatsby Build");

		// Perform the build --> exec is weird
		try {
			let exec = workerUtils.getExecPromise();
			await exec('gatsby build --prefix-paths');
		} catch(errResult) {
			if (errResult.hasOwnProperty("code") || errResult.hasOwnProperty("signal") || errResult.hasOwnProperty("killed")) {
				workerUtils.logInMongo(currentJob, "    (GATSBY)".padEnd(15) + "failed with code: " + errResult.code);
				workerUtils.logInMongo(currentJob, "    (GATSBY)".padEnd(15) + "stdErr: " + errResult.stderr);
				// console.log('\n\nstdout:', errResult.stdout);
				throw errResult;
			}
		};

		workerUtils.logInMongo(currentJob, "    (GATSBY)".padEnd(15) + "Finished Gatsby Build");
	},

	runGithubPush : async function(currentJob) {
		workerUtils.logInMongo(currentJob, " ** Running github push function")

		// remove the contents of the output directory
		await workerUtils.resetDirectory("public");

		// Set the environment variables
		process.env.NAMESPACE = "snooty/documents";
		process.env.PREFIX="guides/andrew/master";
		process.env.STITCH_ID="ref_data-bnbxq";

		// execute the gatsby build
		await workerUtils.promiseTimeoutS(
			gatsbyBuildTimeout, 
			module.exports.gatsbyBuild(currentJob), 
			"Timed out on gatsby build"
		);

		// upload the output to s3
		//let bucketName = payload...;
		let bucketName = "bucketsssss";
		await workerUtils.promiseTimeoutS(
			uploadToS3Timeout, 
			workerUtils.uploadDirectoryToS3Bucket(currentJob, "work", bucketName), 
			"Timed out uploading to bucket " + bucketName + " (most likely permissions problem)"
		);

		// get list of files
		let files = workerUtils.getFilesInDir("public");

		// delete the folder 
		fs.removeSync("public");

		// return the list of filenames
		return files;
	},
}
