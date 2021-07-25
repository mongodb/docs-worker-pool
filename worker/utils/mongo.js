const { MongoClient } = require('mongodb');
const EnvironmentClass = require('../utils/environment').EnvironmentClass;

// Get username password credentials
const username = encodeURIComponent(EnvironmentClass.getAtlasUsername());
const password = encodeURIComponent(EnvironmentClass.getAtlasPassword());
const runXlarge = EnvironmentClass.getXlarge();

const url = `mongodb+srv://${username}:${password}@cluster0-ylwlz.mongodb.net/admin?retryWrites=true`;

// Collection information
const DB_NAME = EnvironmentClass.getDB(); // Database name for autobuilder in MongoDB Atlas
const COLL_NAME = EnvironmentClass.getCollection(); // Collection name in MongoDB Atlas
const META_NAME = 'meta';
const MONITOR_NAME = 'monitor';
const ENTITLEMENTS_NAME = 'entitlements';

// Hold onto the client
let client;

module.exports = {
  url,
  // Initializes the Mongo Client
  async initMongoClient() {
    client = new MongoClient(url, { useNewUrlParser: true });
    return client.connect();
  },

  getEntitlementsCollection() {
    if (client) {
      return client.db(DB_NAME).collection(ENTITLEMENTS_NAME);
    }
    return null;
  },
  // Gets the Queue Collection
  getCollection() {
    if (client) {
      return client.db(DB_NAME).collection(COLL_NAME);
    }
    return null;
  },

  getMonitorCollection() {
    if (client) {
      return client.db(DB_NAME).collection(MONITOR_NAME);
    }
    return null;
  },

  getMetaCollection() {
    if (client) {
      return client.db(DB_NAME).collection(META_NAME);
    }
    return null;
  },

  async reportStatus(monitor) {
    monitor.setXlarge(runXlarge);
    monitor.setEnvType(DB_NAME);
    const monitorCollection = module.exports.getMonitorCollection();
    if (monitorCollection) {
      const query = { _id: monitor.ip };
      const update = {
        $set: { monitor }
      };
      try {
        await monitorCollection.updateOne(query, update, { upsert: true });
      } catch (err) {
        console.log(`Error in reportStatus(): ${err}`);
      }
    } else {
      console.log('Error in reportStatus(): monitorCollection does not exist');
    }
  },

  async getDochubTargets() {
    const arrayList = await this.getDochubArray();
    arrayList.forEach((doc) => {
      console.log(doc);
    });
  },

  // Gets the Next Job Off The Queue And Sets It To inProgress
  async getNextJob(queueCollection) {
    const query = {
      status: 'inQueue',
      'payload.isXlarge': runXlarge,
      createdTime: { $lte: new Date() },
      // We may eventually want to add in the following logic
      // payLoad.jobName: {$in: [jobs]}
    };

    const update = { $set: { startTime: new Date(), status: 'inProgress' } };
    const options = { sort: { priority: -1, createdTime: 1 }, returnNewDocument: true };

    try {
      return queueCollection.findOneAndUpdate(query, update, options);
    } catch (error) {
      console.trace(error)
      throw error
    }
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
    const updateResult = await queueCollection.updateOne(query, update);
    if (updateResult.result.n < 1) {
      throw new Error(`Failed to update job (${job._id}) in queue on success`);
    }
  },

  // Updates the status to be failed and the reason with failed time
  async finishJobWithFailure(queueCollection, job, reason) {
    const query = { _id: job._id };
    const update = {
      $set: { startTime: null, status: 'failed',error: { time: new Date().toString(), reason: reason }}
    };

    const updateResult = await queueCollection.updateOne(query, update);
    if (updateResult.result.n < 1) {
      throw new Error(`Failed to update job (${job._id}) in queue on failure`);
    }
  },

  // Updates the status to be inQueue
  async resetJobForReenqueue(queueCollection, job) {
    const query = { _id: job._id };
    const reenqueueMessage = 'Job restarted due to server shutdown.';

    const update = {
      $set: {
        startTime: null,
        status: 'inQueue',
        error: {},
        logs: [reenqueueMessage],
      }
    };

    const updateResult = await queueCollection.updateOne(query, update);
    if (updateResult.result.n < 1) {
      throw new Error(`Failed to update job (${job._id}) in queue during re-enqueue operation`);
    }
  },

  async updateJobWithPurgedURLs(currentJob, urlArray) {
    const queueCollection = module.exports.getCollection();
    if (queueCollection) {
      const query = { _id: currentJob._id };
      const update = {
        $push: { ['purgedURLs']: urlArray },
      };

      try {
        await queueCollection.updateOne(query, update);
      } catch (err) {
        console.log(`Error in updateJobWithPurgedURLs(): ${err}`);
        throw err
      }
    } else {
      console.log('Error in logInMongo(): queueCollection does not exist');
    }
  },
  
  // Adds Log Message To Job In The Queue
  async logMessageInMongo(currentJob, message) {
    const queueCollection = module.exports.getCollection();
    if (queueCollection) {
      const query = { _id: currentJob._id };
      const update = {
        $push: { ['logs']: message },
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
    const queueCollection = module.exports.getCollection();
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
