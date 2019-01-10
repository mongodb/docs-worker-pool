
// Imports
const http    = require('http');
const express = require('express');
const mongo   = require('./utils/mongo');
const utils   =  require('./utils/utils');
const fs   = require('fs-extra');
const { createTerminus } = require('@godaddy/terminus');

// **** IF YOU ARE ADDING A FUNCTION --> IMPORT IT HERE
// Import job function
const {runGithubPush} = require('./jobTypes/githubPushJob');

const app = express()

// Variables
let queueCollection;              // Holder for the queueCollection in MongoDB Atlas
let currentJob;                   // Holder for the job currently executing 
let ready = false;                // Variable used to see if the worker is ready 
let live = true;                  // Variable used to see if the worker has failed
let lastCheckIn = new Date();     // Variable used to see if the worker has failed
let httpServer; 
let mongoClient;

// Constants
const port = 3000;                // Port to start the Terminus http server
const dbName = "pool";            // Database name of the queue in MongoDB Atlas
const collName = "queue";         // Collection name of the queue in MongoDB Atlas
const mongoTimeoutS = 15;         // Reject any mongo operation taking longer than this number of seconds
const jobTimeoutS = 60 * 60 * 2;  // Reject any job taking longer than this number of seconds
const retryMs = 5 * 1000;         // Number of milliseconds to wait before querying for a new job after not finding one

// If the worker has not updated lastCheckin in maxCheckin seconds --> kubernetes will know
// Set to be the critical path of the worker plus 10 minutes
const maxCheckIn = (2 * mongoTimeoutS + jobTimeoutS + 60*10) * 1000; 

// **** IF YOU ARE ADDING A FUNCTION --> ADD IT TO THIS DICTIONARY
// Dictionary of possible jobs for this node
var jobTypeToFunc = {
	"githubPush": runGithubPush,
}

module.exports = {
	/***********************************************************************************
	 *                           Functions Used For Testing                            *
	 ***********************************************************************************/
	setLive : function(arg) {
		live = arg;
	}, 

	setCurrentJob : function(job) {
		currentJob = job;
	},

	setLastCheckin : function(date) {
		lastCheckIn = date;
	}, 

	addJobTypeToFunc : function(jobType, func) {
		jobTypeToFunc[jobType] = func;
	},

	/***********************************************************************************
	 *                    Terminus / Kubernetes Related Functions                      *
	 ***********************************************************************************/
	onSignal : async function() {
		console.log('\nServer is starting cleanup');
		ready = false;
		if (currentJob) {
			console.log("Resetting Job with ID: ", currentJob._id);
			utils.resetDirectory("work/");
			await utils.promiseTimeoutS(
				mongoTimeoutS, 
				await mongo.finishJobWithFailure(queueCollection, currentJob._id, "Server is being shutdown", currentJob.numFailures - 1), 
				"Mongo Timeout Error: Timed out finishing failed job with jobId: " + currentJob._id
			);
		}
		if (httpServer) {
			httpServer.close();
		}
		if (mongoClient) {
			mongoClient.close();
		}
	}, 

	livenessCheck : async function() {
		if (!live) {
			throw "Server Failed To Startup";
		}
		let timeSince = (new Date()).getTime() - lastCheckIn.getTime();
		if (timeSince > maxCheckIn) {
			throw "Server has not checked in " + timeSince / 1000 + " seconds " + 
			      "(maxCheckin = " + maxCheckIn + ")";
		}
	}, 

	readinessCheck : async function() {
		if (!ready) {
			throw "Not Yet Ready"
		}
	}, 

	/***********************************************************************************
	 *                                  main function                                  *
	 ***********************************************************************************/
	work : async function() {
		try {
			console.log();
			lastCheckIn = new Date();
			currentJob = null;
	
			// Get a new job
			let job = await utils.promiseTimeoutS(
				mongoTimeoutS, 
				mongo.getNextJob(queueCollection), 
				"Mongo Timeout Error: Timed out getting next job from queue collection"
			);
			
			if (job && job.value) {
			// if (job.value && Math.random() < 1) {
				currentJob = job.value;
				console.log("* Starting Job with ID: ", currentJob._id, " and type: " + currentJob.payload.jobType);
	
				// Throw error if we cannot perform this job
				if (!(currentJob.payload.jobType in jobTypeToFunc)) {
					throw new Error("Job type of (" + currentJob.payload.jobType + ") not recognized")
				}
				
				// Perform the job
				await utils.promiseTimeoutS(
					jobTimeoutS, 
					jobTypeToFunc[currentJob.payload.jobType](currentJob.payload, currentJob._id), 
					"Worker Timeout Error: Timed out performing " + currentJob.payload.jobType + 
						" for jobId: " + currentJob._id
				);
				
				// Update the job to have success = true 
				const result = {success: "true"};
				await utils.promiseTimeoutS(
					mongoTimeoutS, 
					mongo.finishJobWithResult(queueCollection, currentJob._id, result), 
					"Mongo Timeout Error: Timed out finishing successful job with jobId: " + currentJob._id
				);
	
				console.log("    (DONE)".padEnd(15) + "Finished Job with ID: " + currentJob._id);
				setTimeout(module.exports.work, 100);
			} else {
				// Log that no jobs were found and resume working after retryMs milliseconds
				console.log("No Jobs Found....: ", new Date());
				setTimeout(module.exports.work, retryMs);
			}
		} catch (err) {
			// Log the Error: 
			console.log("worker.work() error: "+ err);
	
			// Start new job before labeling the previous job as a failure so that it does not just 
			// get the same job that it just failed at
			setTimeout(module.exports.work, 100);
	
			// If there is a current job --> update the job document to be failed 
			if (currentJob) {
				// If we end up here, then the folder work/jobId will still be there, so delete it
				fs.removeSync("work/" + currentJob._id);

				// Try to finish the job with failure and retry a 3 times
				utils.retry(mongo.finishJobWithFailure(queueCollection, currentJob._id, err.toString(), currentJob.numFailures), 3)
				.catch(errObj => {
					console.log("****** finishJobWithFailure failed for job " + currentJob._id + 
								" and failure {" + err.toString() + "} with err: " + errObj.toString());
				});
			}
		}	
	}, 

	/***********************************************************************************
	 *                    Start the server and set everything up                       *
	 ***********************************************************************************/
	startServer : async function() {
		// Initialize MongoDB Collection 
		let mongoClient = await mongo.initMongoClient();
		if (mongoClient) { // <-- this is just for testing
			queueCollection = mongoClient.db(dbName).collection(collName);
		}

		// Clean up the work folder
		utils.resetDirectory("work/");

		// Create HTTP Server
		httpServer = http.createServer(app);

		// Initialize Terminus with proper options
		let terminusOptions = {
			logger: console.log,
			healthChecks: {
				"/liveness": module.exports.livenessCheck, 
				"/readiness": module.exports.readinessCheck,
			},
			signal: 'SIGINT',
			onSignal: module.exports.onSignal,
		}; 
		createTerminus(httpServer, terminusOptions);

		// Start the http server
		httpServer.listen(port);
		ready = true;
	},
}