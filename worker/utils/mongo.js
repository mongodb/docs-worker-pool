const MongoClient = require("mongodb").MongoClient;

// Get username password credentials
const username = process.env.MONGO_ATLAS_USERNAME;
const password = process.env.MONGO_ATLAS_PASSWORD;
const url = "mongodb+srv://" + username + ":" + password + "@cluster0-ylwlz.mongodb.net/admin?retryWrites=true";

// Collection information
const DB_NAME   = "pool";             // Database name of the queue in MongoDB Atlas
const COLL_NAME = "queue";          // Collection name of the queue in MongoDB Atlas

// Hold onto the client
let client;

module.exports = {
	/***********************************************************************************
	 *   initMongoClient() --> initializes Mongo client                                *
	 ***********************************************************************************/
	initMongoClient : async function() {
		client = new MongoClient(url, { useNewUrlParser: true });
		return await client.connect();
	}, 

	/***********************************************************************************
	 *   getQueueCollection() --> gets the queue collection                            *
	 ***********************************************************************************/
	getQueueCollection : function() {
		if (client) {
			return client.db(DB_NAME).collection(COLL_NAME);
		}
	},

	/***********************************************************************************
	 *   getNextJob() --> gets the next job off the queue and sets it to inProgress    *
	 ***********************************************************************************/
	getNextJob : async function(queueCollection) {
		const query = {
			status: "inQueue",
			createdTime: {$lte: new Date()},
			
			// We may eventually want to add in the following logic, so I am leaving it here commented out
			// payLoad.jobName: {$in: [jobs]}
		};

		const update = {"$set": { startTime: new Date(), status: 'inProgress' } };
		const options = { sort: { priority: -1, createdTime: 1 } };

		return await queueCollection.findOneAndUpdate(query, update, options);
	},
	/***********************************************************************************
	 *   finishJobWithResult() --> sends job to completed status and sets end time     *
	 ***********************************************************************************/
	finishJobWithResult : async function(queueCollection, job, result) {
		const query = {_id: job._id};
		const update = {$set: {
			status:  "completed",
			result:  result, 
			endTime: new Date(),
		}};
		let updateResult = await queueCollection.updateOne(query, update);
		if (updateResult.result.n < 1) {
			throw new Error("Failed to update job (" + jobId + ") in queue on success");
		}
	},

	/***********************************************************************************
	 *   finishJobWithFailure() --> sends job to inQueue or failed status              *
	 ***********************************************************************************/
	finishJobWithFailure : async function(queueCollection, job, reason) {
		const query = {_id: job._id};
		const update = {
			$set:  {startTime: null, status: "inQueue"}, 
			$push: {failures: {time: new Date(), reason: reason}}, 
			$inc:  {numFailures: 1}, 
		};

		if (job.numFailures >= 2) {
			update["$set"]["status"] = "failed";
		}
		
		let updateResult = await queueCollection.updateOne(query, update);
		if (updateResult.result.n < 1) {
			throw new Error("Failed to update job (" + jobId + ") in queue on failure");
		}
	}, 

	/***********************************************************************************
	 *   logInMongo() --> adds log message to the job in the queue                     *
	 ***********************************************************************************/
	logInMongo : async function(currentJob, message) {
		let queueCollection = module.exports.getQueueCollection();
		if (queueCollection) {
			const query = {_id: currentJob._id};
			const update = {
				$push: {["logs.try" + currentJob.numFailures]: message}, 
			};
			
			try {
				await queueCollection.updateOne(query, update);
			} catch(err) {
				console.log("Error in logInMongo(): " + err);
			}
		} else {
			console.log("Error in logInMongo(): queueCollection does not exist");
		}

	}, 
}