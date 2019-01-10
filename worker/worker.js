
// Imports
const http    		= require('http');
const express 		= require('express');
const mongo   		= require('./utils/mongo');
const workerUtils   =  require('./utils/utils');
const fs      		= require('fs-extra');
const retry   		= require('async-retry')


// **** IF YOU ARE ADDING A FUNCTION --> IMPORT IT HERE
// Import job function
const {runGithubPush} = require('./jobTypes/githubPushJob');

const app = express()

// Variables
let queueCollection;                // Holder for the queueCollection in MongoDB Atlas
let currentJob;                     // Holder for the job currently executing 
let lastCheckIn = new Date();       // Variable used to see if the worker has failed
let shouldStop = false;
let mongoClient;

// Constants
const MONGO_TIMEOUT_S = 15;         // Reject any mongo operation taking longer than this number of seconds
const JOB_TIMEOUT_S = 60 * 60 * 2;  // Reject any job taking longer than this number of seconds
const RETRY_TIMEOUT_MS = 5 * 1000;  // Number of seconds to wait before querying for a new job after not finding one
const MIN_TIMEOUT_MS = 1;           // Small timeout to re-call the work() function 
const LOG_PADDING = 15;             // For formatting the log output

// **** IF YOU ARE ADDING A FUNCTION --> ADD IT TO THIS DICTIONARY
// Dictionary of possible jobs for this node
var jobTypeToFunc = {
	"githubPush": runGithubPush,
}

module.exports = {
	/***********************************************************************************
	 *                           Functions Used For Testing                            *
	 ***********************************************************************************/
	setCurrentJob : function(job) {
		currentJob = job;
	},

	addJobTypeToFunc : function(jobType, func) {
		jobTypeToFunc[jobType] = func;
	},

	/***********************************************************************************
	 *                      Terminus / Kubernetes Related Functions                    *
	 ***********************************************************************************/
	gracefulShutdown : async function() {
		console.log('\nServer is starting cleanup');
		shouldStop = true;

		if (currentJob) {
			let logMsg = "    (ERROR)".padEnd(LOG_PADDING) + "Resetting Job with ID: " + currentJob._id + " because server is being shut down";
			workerUtils.logInMongo(currentJob, logMsg);

			workerUtils.resetDirectory("work/");
			await workerUtils.promiseTimeoutS(
				MONGO_TIMEOUT_S, 
				await mongo.finishJobWithFailure(queueCollection, currentJob, "Server is being shutdown"), 
				"Mongo Timeout Error: Timed out finishing failed job with jobId: " + currentJob._id
			);
		}
		if (mongoClient) {
			mongoClient.close();
		}
	}, 

	/***********************************************************************************
	 *                                  main function                                  *
	 ***********************************************************************************/
	work : async function() {
		try {
			lastCheckIn = new Date();
			currentJob = null;
			let logMsg;

			if (shouldStop) {
				throw new Error("Shutting Down --> Should not get new jobs");
			}
	
			// Get a new job
			let job = await workerUtils.promiseTimeoutS(
				MONGO_TIMEOUT_S, 
				mongo.getNextJob(queueCollection), 
				"Mongo Timeout Error: Timed out getting next job from queue collection"
			);
			
			// If there was a job in the queue
			if (job && job.value) {
				currentJob = job.value;

				let logMsg = "* Starting Job with ID: " + currentJob._id + " and type: " + currentJob.payload.jobType;
				workerUtils.logInMongo(currentJob, logMsg)
	
				// Throw error if we cannot perform this job / it is not a valid job
				if (!(currentJob.payload.jobType in jobTypeToFunc)) {
					throw new Error("Job type of (" + currentJob.payload.jobType + ") not recognized")
				}
				
				// Perform the job
				let result = await workerUtils.promiseTimeoutS(
					JOB_TIMEOUT_S, 
					jobTypeToFunc[currentJob.payload.jobType](currentJob), 
					"Worker Timeout Error: Timed out performing " + currentJob.payload.jobType + 
						" for jobId: " + currentJob._id
				);
				
				// Update the job to be successful
				await workerUtils.promiseTimeoutS(
					MONGO_TIMEOUT_S, 
					mongo.finishJobWithResult(queueCollection, currentJob, result), 
					"Mongo Timeout Error: Timed out finishing successful job with jobId: " + currentJob._id
				);
	
				// Log that we are done with this job
				logMsg = "    (DONE)".padEnd(LOG_PADDING) + "Finished Job with ID: " + currentJob._id;
				workerUtils.logInMongo(currentJob, logMsg);

				// Must use timeout for testing purposes (but essentially this is just re-calling work())
				setTimeout(module.exports.work, MIN_TIMEOUT_MS);
			} else {
				// Log that no jobs were found
				console.log("No Jobs Found....: ", new Date());

				// Wait retryMs milliseconds and then try work() again
				setTimeout(module.exports.work, RETRY_TIMEOUT_MS);
			}
		} catch (err) {	
			// Create a deep copy of the current job to prevent it from being overwritten
			let lastJob = workerUtils.cloneObject(currentJob);
			console.log(err);
			
			// Start new job before labeling the previous job as a failure so that it does not just 
			// get the same job that it just failed at
			if (!shouldStop) {
				setTimeout(module.exports.work, MIN_TIMEOUT_MS);
			}
	
			// If there is a current job --> update the job document to be failed 
			if (lastJob) {
				// Log the error: 
				workerUtils.logInMongo(lastJob, "    (ERROR)".padEnd(LOG_PADDING) + err);

				// If we end up here, then the folder work/jobId will still be there, so delete it
				fs.removeSync("work/" + lastJob._id);

				// Try to finish the job with failure and retry it 3 times
				await retry(async bail => {
					mongo.finishJobWithFailure(queueCollection, lastJob, err.toString());
				}, {
					retries: 3
				}).catch(errObj => {
					console.log("****** finishJobWithFailure failed for job " + lastJob._id + 
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
			queueCollection = mongo.getQueueCollection();
		}

		// Clean up the work folder
		workerUtils.resetDirectory("work/");
	},
}