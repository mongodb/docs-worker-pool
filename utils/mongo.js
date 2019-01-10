const MongoClient = require("mongodb").MongoClient;

// Get username password credentials
const username = process.env.MONGO_ATLAS_USERNAME;
const password = process.env.MONGO_ATLAS_PASSWORD;
const url = "mongodb+srv://" + username + ":" + password + "@cluster0-ylwlz.mongodb.net/admin?retryWrites=true";

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
	 *   getNextJob() --> gets the next job off the queue and sets it to inProgress    *
	 ***********************************************************************************/
	getNextJob : async function(queueCollection) {
		const query = {
			status: "inQueue",
			createdTime: {$lte: new Date()},
			// payLoad.jobName: {$in: [jobs]}
		};

		const update = {"$set": { startTime: new Date(), status: 'inProgress' } };
		const options = { sort: { priority: -1, createdOn: 1 } };

		return await queueCollection.findOneAndUpdate(query, update, options);
	},
	/***********************************************************************************
	 *   finishJobWithResult() --> sends job to completed status and sets end time     *
	 ***********************************************************************************/
	finishJobWithResult : async function(queueCollection, jobId, result) {
		const query = {_id: jobId};
		const update = {$set: {
			status: "completed",
			result: result, 
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
	finishJobWithFailure : async function(queueCollection, jobId, reason, numFailure) {
		const query = {_id: jobId};
		const update = {
			$set: {startTime: null, numFailures: numFailure+1, status: "inQueue"}, 
			$push: {failures: {time: new Date(), reason: reason}}, 
		};
		if (numFailure >= 2) {
			update["$set"]["status"] = "failed";
		}
		
		let updateResult = await queueCollection.updateOne(query, update);
		if (updateResult.result.n < 1) {
			throw new Error("Failed to update job (" + jobId + ") in queue on failure");
		}
	}, 
}