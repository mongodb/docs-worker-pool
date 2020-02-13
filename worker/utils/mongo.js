const { MongoClient } = require('mongodb');

// Get username password credentials
const username = encodeURIComponent(process.env.MONGO_ATLAS_USERNAME);
const password = encodeURIComponent(process.env.MONGO_ATLAS_PASSWORD);
const runXlarge = process.env.XLARGE === undefined ? false : Boolean(process.env.XLARGE);

const url = `mongodb+srv://${username}:${password}@cluster0-ylwlz.mongodb.net/admin?retryWrites=true`;

// Collection information
const DB_NAME = process.env.DB_NAME ? process.env.DB_NAME : 'pool'; // Database name of the queue in MongoDB Atlas
const COLL_NAME = 'queue'; // Collection name of the queue in MongoDB Atlas
const META_NAME = 'meta';

// Hold onto the client
let client;

module.exports = {
  // Initializes the Mongo Client
  async initMongoClient() {
    client = new MongoClient(url, { useNewUrlParser: true });
    return client.connect();
  },

  // Gets the Queue Collection
  getQueueCollection() {
    if (client) {
      return client.db(DB_NAME).collection(COLL_NAME);
    }
    return null;
  },

  getMetaCollection() {
    if (client) {
      return client.db(DB_NAME).collection(META_NAME);
    }
    return null;
  },

  // Gets the Next Job Off The Queue And Sets It To inProgress
  async getNextJob(queueCollection) {
    const query = {
      status: 'inQueue',
      "payload.isXlarge": runXlarge,
      createdTime: { $lte: new Date() },

      // We may eventually want to add in the following logic
      // payLoad.jobName: {$in: [jobs]}
    };
    
    const update = { $set: { startTime: new Date(), status: 'inProgress' } };
    const options = { sort: { priority: -1, createdTime: 1 } };

    return queueCollection.findOneAndUpdate(query, update, options);
  },

  // Sends Job To completed Status and Sets End Time
  async finishJobWithResult(queueCollection, job, result) {
    const query = { _id: job._id };
    const update = {
      $set: {
        status: 'completed',
        result,
        endTime: new Date(),
      },
    };
    const updateResult = await queueCollection.
      updateOne(query, update);
    if (updateResult.result.n < 1) {
      throw new Error(`Failed to update job (${job._id}) in queue on success`);
    }
  },

  // Sends Job To inQueue Status or Failed Status Depending on job.numFailures
  async finishJobWithFailure(queueCollection, job, reason) {
    const query = { _id: job._id };
    const update = {
      $set: { startTime: null, status: 'inQueue' },
      $push: { failures: { time: new Date(), reason } },
      $inc: { numFailures: 1 },
    };

    if (job.numFailures >= 2) {
      update.$set.status = 'failed';
    }

    const updateResult = await queueCollection.updateOne(query, update);
    if (updateResult.result.n < 1) {
      throw new Error(`Failed to update job (${job._id}) in queue on failure`);
    }
  },

  // Adds Log Message To Job In The Queue
  async logMessageInMongo(currentJob, message) {
    const queueCollection = module.exports.getQueueCollection();
    if (queueCollection) {
      const query = { _id: currentJob._id };
      const update = {
        $push: { [`logs.try${currentJob.numFailures}`]: message },
      };

      try {
        await queueCollection.updateOne(query, update);
      } catch (err) {
        console.log(`Error in logInMongo(): ${err}`);
      }
    } else {
      console.log('Error in logInMongo(): queueCollection does not exist');
    }
  },
  // Adds Log Message To Job In The Queue
  async populateCommunicationMessageInMongo(currentJob, message) {
    const queueCollection = module.exports.getQueueCollection();
    if (queueCollection) {
      const query = { _id: currentJob._id };
      const update = {
        $push: { comMessage: message },
      };
      try {
        await queueCollection.updateOne(query, update);
      } catch (err) {
        console.log(`Error in populateCommunicationMessageInMongo(): ${err}`);
      }
    } else {
      console.log(
        'Error in populateCommunicationMessageInMongo(): queueCollection does not exist'
      );
    }
  },
};