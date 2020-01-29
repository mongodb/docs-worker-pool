//const fs = require('fs-extra');
const workerUtils = require("./utils");
const GitHubJob = require("../jobTypes/githubJob").GitHubJobClass;
const S3Publish = require("../jobTypes/S3Publish").S3PublishClass;
const validator = require("validator");
const fs = require('fs-extra');
const Logger = require("./logger").LoggerClass;
const buildTimeout = 60 * 450;
const { MongoClient } = require('mongodb');
const mongo = require('./mongo');
const EnvironmentClass = require('./environment').EnvironmentClass;
const dbName = EnvironmentClass.getDB();
const invalidJobDef = new Error("job not valid");
const collName = process.env.COL_NAME;
const username = process.env.USERNAME;
const secret = process.env.SECRET;

async function insertJobInTestEnvironment(payloadObj) {
    // create the new job document
    const newJob = {
      title: 'Regression Test',
      user: 'madelinezec',
      email: 'mez2113@columbia.edu',
      status: 'inQueue',
      createdTime: new Date(),
      startTime: null,
      endTime: null,
      priority: 1,
      numFailures: 0,
      failures: [],
      result: null,
      payload: payloadObj,
      logs: {},
    };
    console.log("this is new job!!!! ", newJob)
    return new Promise(function(resolve, reject) {
      const filterDoc = { payload: payloadObj, status: { $in: ['inProgress', 'inQueue'] } };
      const updateDoc = { $setOnInsert: newJob };

      const uri = `mongodb+srv://${username}:${secret}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
      const client = new MongoClient(uri, { useUnifiedTopology: true, useNewUrlParser: true });
      client.connect((err) => {
        if (err) {
          console.error('error connecting to Mongo');
          reject(err);
        }
        const collection = client.db(dbName).collection(collName);

        collection.updateOne(filterDoc, updateDoc, { upsert: true }).then(
          (result) => {
            if (result.upsertedId) {
              console.log(`You successfully enqued a staging job to docs autobuilder. This is the record id: ${result.upsertedId}`);
             return resolve(result.upsertedId);
            }
            console.log('This job already exists ');
            return reject('Already Existed');
          },
          (error) => {
            console.error(`There was an error enqueing a staging job to docs autobuilder. Here is the error: ${error}`);
            return reject(error);
          },
        );
        client.close();
      });
    })

  }


async function changeStream(currentJob) {
  const uri = `mongodb+srv://${username}:${secret}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useUnifiedTopology: true,
    useNewUrlParser: true
  });

  

  const pipeline = [
    { $match: { 'fullDocument.title': 'Regression Test' }}
  ];
  

  return new Promise( async function(resolve, reject) {
    console.log("inside here!!!")
    client.connect(async function(err){
      console.log("it appears we have connected!!!!")
      if (err) {
        console.error('error connecting to Mongo');
        reject(err);
      }
      const db = client.db(dbName);
      const collection = db.collection(collName);
     // const changeStream = collection.watch({ fullDocument: 'updateLookup' });
     const changeStream = collection.watch(
      [{
        $match: {
          $and: [
            { 'fullDocument.title': 'Regression Test' },
            { operationType: "update" }
          ]
        }
      }],
      {
        fullDocument: "updateLookup"
      }
    );
      var completedChildJobs = 0;
      changeStream.on("change", (updatedJob, error) => {
        console.log("the updated job!!!!! ", updatedJob.fullDocument["status"])
        if(error){
          console.log("error!!!! ", error);
        }
        if (
          updatedJob.fullDocument["title"] === 'Regression Test' &&
          updatedJob.fullDocument["status"] != "inProgress" &&
          updatedJob.fullDocument["status"] != "inQueue"
        ) {
          ++completedChildJobs;
          console.log("this is the count! ", completedChildJobs);
          if (completedChildJobs === 2){
            resolve(true);
          }
        }
      });

      /*create and enqueue staging jobs for testing*/
      let fileContents;
      let reposSupportedForStaging;
    
      /*Staging*/
      try {
        fileContents = fs.readFileSync("./json/supported-docs-repos.json", "utf8");
      } catch (err) {
        const errorReadFile = new Error("error reading file: ", err);
        throw errorReadFile;
      }
    
      try {
        reposSupportedForStaging = JSON.parse(fileContents)["repos"];
      } catch (error) {
        const errorParsingJson = new Error("error parsing json: ", error);
      }
    
      var stagePayloads = [];
    
      var counter = 0;
      reposSupportedForStaging.forEach(function(repository) {
        stagePayloads.push(
          createPayload(
            repository["name"],
            repository["owner"],
            "nothing",
            "githubPush", 
            currentJob["_id"]
          )
        );
        counter = counter++;
        console.log(counter);
      });
    
      // console.log(stagePayloads)
      let poolTestJobs = [];
      let poolJobs = [];
    
      /*insert jobs */
      for (const payload of stagePayloads) {
        console.log("hi!!! ", currentJob["_id"]);
        const testResult = insertJobInTestEnvironment(
          payload
        );
      }

})
});



  
}


function createPayload(
  repoNameArg,
  repoOwnerArg,
  urlArg,
  typeOfJob, 
  parentID
) {
  const payload = {
    jobType: typeOfJob,
    source: "github",
    action: "push",
    repoName: repoNameArg,
    branchName: 'master',
    isFork: true,
    private: false,
    isXlarge: false,
    repoOwner: repoOwnerArg,
    url: `https://github.com/${repoOwnerArg}/${repoNameArg}`,
    newHead: "regressionTesting",
  };

  return payload;
}

  // Look Up Job In The Queue
  async function lookUpJob(jobId) {
    const queueCollection = mongo.getQueueCollection();

    if (queueCollection) {
      //we want to wait for the jobs to complete before we compare
        try {
          const item = await queueCollection.findOne({ _id: jobId });
          console.log("this is the item we found in queueCollection?", item)
          return  item
        } catch (err) {
          console.log(`Error in logInMongo(): ${err}`);
        }
      
    } else {
      console.log('Error in logInMongo(): queueCollection does not exist');
    }

  }

module.exports = {
  createPayload, 
  insertJobInTestEnvironment,
  lookUpJob,
  changeStream
}