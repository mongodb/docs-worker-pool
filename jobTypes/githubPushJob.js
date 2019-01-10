const utils = require('../utils/utils');
const fs   = require('fs-extra');
const gitCloneTimeout = 20;
const gatsbyBuildTimeout = 100;
const uploadToS3Timeout = 20;

module.exports = {

	gatsbyBuild : async function(args) {
		console.log("    (GATSBY)".padEnd(15) + "Running Gatsby Build");
		var result = await utils.resolveAfterNSeconds(30);
		console.log("    (GATSBY)".padEnd(15) + "Finished Gatsby Build");
	},

	runGithubPush : async function(payload, jobId) {
		console.log(" ** Running github push function");

		// remove the contents of the work directory
		await utils.resetDirectory("work/" + jobId);

		// clone the repository
		// const remote = `https://${USER}:${PASS}@github.com/${payload.repoOwner}/${payload.repoName}`;
		// const dir = "work/"
		// await utils.promiseTimeoutS(
		// 	gitCloneTimeout, 
		// 	utils.cloneGitRepository(remote, dir), 
		// 	"Timed out cloning " + remote + " (most likely permissions problem)"
		// );

		// execute the gatsby build
		await utils.promiseTimeoutS(
			gatsbyBuildTimeout, 
			module.exports.gatsbyBuild(), 
			"Timed out on gatsby build"
		);

		// upload the output to s3
		
		//let bucketName = payload...;
		let bucketName = "bucket";
		await utils.promiseTimeoutS(
			uploadToS3Timeout, 
			utils.uploadDirectoryToS3Bucket("work", bucketName), 
			"Timed out uploading to bucket " + bucketName + " (most likely permissions problem)"
		);

		// delete the folder 
		fs.removeSync("work/" + jobId);
	},
}
