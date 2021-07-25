// Imports
const express = require('express');
const fs = require('fs-extra');
const retry = require('async-retry');
const mongo = require('./utils/mongo');
const { Monitor } = require('./utils/monitor');
const workerUtils = require('./utils/utils');

// **** IF YOU ARE ADDING A FUNCTION --> IMPORT IT HERE
// Import job function
const { runGithubPush, safeGithubPush } = require('./jobTypes/githubPushJob');
const { runGithubProdPush, safeGithubProdPush } = require('./jobTypes/productionDeployJob')
const {
  runPublishDochub,
  safePublishDochub
} = require('./jobTypes/publishDochubJob');

// add some application monitoring
const monitorInstance = new Monitor({ component: 'worker' }, mongo);

// Variables
let queueCollection; // Holder for the queueCollection in MongoDB Atlas

let currentJob; // Holder for the job currently executing
let lastCheckIn = new Date(); // Variable used to see if the worker has failed
let shouldStop = false;
let mongoClient;

// Constants
const MONGO_TIMEOUT_S = 15; // Reject any mongo operation taking longer than this number of seconds
const JOB_TIMEOUT_S = 15 * 60; // Reject any job taking longer than this number of seconds
const RETRY_TIMEOUT_MS = 5 * 1000; // Number of seconds to wait after not finding one
const MIN_TIMEOUT_MS = 1; // Small timeout to re-call the work() function
const LOG_PADDING = 15; // For formatting the log output
const PORT = 3000; // For the liveness check

// If the worker has not updated lastCheckin in maxCheckin seconds --> kubernetes will know
// Set to be the critical path of the worker plus 10 minutes
const maxCheckIn = (2 * MONGO_TIMEOUT_S + JOB_TIMEOUT_S + 60 * 10) * 1000;

// **** IF YOU ARE ADDING A FUNCTION --> ADD IT TO THIS DICTIONARY
// Dictionary of possible jobs for this node
const jobTypeToFunc = {
  githubPush: { function: runGithubPush, safe: safeGithubPush },
  productionDeploy : {function: runGithubProdPush, safe: safeGithubProdPush},
  publishDochub: { function: runPublishDochub, safe: safePublishDochub }
};

// route for liveness check
const app = express();
app.get('/liveness', (req, res) => {
  const result = module.exports.getLiveness();
  res.status(result.status).send({ msg: result.msg });
});

module.exports = {
  //
  // Functions Used For Testing
  //
  setCurrentJob(job) {
    currentJob = job;
  },

  addJobTypeToFunc(jobType, func) {
    jobTypeToFunc[jobType] = { function: func, safe: safeGithubPush };
  },

  setLastCheckIn(lastCheck) {
    lastCheckIn = lastCheck;
  },

  getLiveness() {
    const timeSince = new Date().getTime() - lastCheckIn.getTime();
    if (timeSince > maxCheckIn) {
      const errMsg = `Server has not checked in ${timeSince /
        1000} seconds (maxCheckin = ${maxCheckIn})`;
      return { status: 500, msg: errMsg };
    }
    const success = `Server checked in ${timeSince / 1000} seconds ago`;
    return { status: 200, msg: success };
  },

  // Function to handle server shutdown
  async gracefulShutdown() {
    console.log('\nServer is starting cleanup');
    shouldStop = true;

    if (currentJob) {
      const logMsg = `${'    (ERROR)'.padEnd(
        LOG_PADDING
      )}Resetting Job with ID: ${
        currentJob._id
      } because server is being shut down`;
      workerUtils.logInMongo(currentJob, logMsg);

      workerUtils.resetDirectory('work/');
      await workerUtils.promiseTimeoutS(
        MONGO_TIMEOUT_S,
        await mongo.resetJobForReenqueue(
          queueCollection,
          currentJob,
        ),
        `Mongo Timeout Error: Timed out finishing re-enqueueing job with jobId: ${currentJob._id}`
      );
    }
    if (mongoClient) {
      monitorInstance.reportStatus('closed connection');
      mongoClient.close();
      console.log('\nServer has closed mongo client connection');
    }
  },

  //  Start the server and set everything up
  async startServer() {
    // Initialize MongoDB Collection
    // This is the collection that houses the work tickets
    mongoClient = await mongo.initMongoClient();
    if (mongoClient) {
      queueCollection = mongo.getCollection();
    }
    monitorInstance.reportStatus('start server');

    // Clean up the work folder
    workerUtils.resetDirectory('work/');

    // Setup http server
    return app.listen(PORT);
  },

  // Main function for the worker
  async work() {
    try {
      lastCheckIn = new Date();
      currentJob = null;
      let logMsg;

      if (shouldStop) {
        monitorInstance.reportStatus('shutting down');
        throw new Error('Shutting Down --> Should not get new jobs');
      }

      // Get a new job
      const job = await workerUtils
        .promiseTimeoutS(
          MONGO_TIMEOUT_S,
          mongo.getNextJob(queueCollection),
          'Mongo Timeout Error: Timed out getting next job from queue collection'
        )
        .catch(error => {
          console.log('connection timeout');
          monitorInstance.reportStatus(`error getting job ${error}`);
        });

      // If there was a job in the queue
      if (job && job.value) {
        currentJob = job.value;

        monitorInstance.reportStatus('running job');

        logMsg = `* Starting Job with ID: ${currentJob._id} and type: ${currentJob.payload.jobType}`;
        workerUtils.logInMongo(currentJob, logMsg);

        // Throw error if we cannot perform this job / it is not a valid job
        if (
          !currentJob.payload.jobType ||
          !(currentJob.payload.jobType in jobTypeToFunc)
        ) {
          throw new Error(
            `Job type of (${currentJob.payload.jobType}) not recognized`
          );
        }

        // Sanitize the job (note that jobs that do not implement the sanitize function
        // will not proceed

        await workerUtils.promiseTimeoutS(
          JOB_TIMEOUT_S,
          jobTypeToFunc[currentJob.payload.jobType].safe(currentJob),
          `Worker Timeout Error: Timed out performing ${currentJob.payload.jobType} for jobId: ${currentJob._id}`
        );

        // Perform the job
        const result = await workerUtils.promiseTimeoutS(
          JOB_TIMEOUT_S,
          jobTypeToFunc[currentJob.payload.jobType].function(currentJob),
          `Worker Timeout Error: Timed out performing ${currentJob.payload.jobType} for jobId: ${currentJob._id}`
        );

        // Update the job to be successful
        await workerUtils
          .promiseTimeoutS(
            MONGO_TIMEOUT_S,
            mongo.finishJobWithResult(queueCollection, currentJob, result),
            `Mongo Timeout Error: Timed out finishing successful job with jobId: ${currentJob._id}`
          )
          .catch(error => {
            console.log(error);
          });

        // Log that we are done with this job
        logMsg = `${'    (DONE)'.padEnd(LOG_PADDING)}Finished Job with ID: ${
          currentJob._id
        }`;
        workerUtils.logInMongo(currentJob, logMsg);

        // Must use timeout for testing purposes (essentially just re-calling work())
        setTimeout(module.exports.work, MIN_TIMEOUT_MS);
      } else {
        // Log that no jobs were found
        console.log('No Jobs Found....: ', new Date());
        monitorInstance.reportStatus('No Jobs Found');

        // Wait retryMs milliseconds and then try work() again
        setTimeout(module.exports.work, RETRY_TIMEOUT_MS);
      }
    } catch (err) {
      console.log(`  Error caught by first catch: ${err}`);
      try {
        // Create a deep copy of the current job to prevent it from being overwritten
        const lastJob = JSON.parse(JSON.stringify(currentJob));
        lastJob._id = currentJob._id;

        // Start new job before labeling the previous job as a failure so that it
        // does not just get the same job that it just failed at
        if (!shouldStop) {
          setTimeout(module.exports.work, MIN_TIMEOUT_MS);
        }

        // If there is a current job --> update the job document to be failed
        if (lastJob) {
          // Log the error:
          workerUtils.logInMongo(
            lastJob,
            '    (ERROR)'.padEnd(LOG_PADDING) + err.toString()
          );

          // If we end up here, then the folder work/jobId will still be there --> delete
          fs.removeSync(`work/${lastJob._id}`);

          // Try to finish the job with failure and retry it 3 times
          await retry(
            async () => {
              mongo.finishJobWithFailure(
                queueCollection,
                lastJob,
                err.toString()
              );
            },
            {
              retries: 3
            }
          ).catch(errObj => {
            console.log(
              `****** finishJobWithFailure failed for job ${
                lastJob._id
              } and failure {${err.toString()}} with err: ${errObj.toString()}`
            );
          });
        }
      } catch (err2) {
        console.log(`  Error caught by second catch: ${err2}`);
      }
    }
  }
};
