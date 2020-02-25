const workerUtils = require("./utils");
const GitHubJob = require("../jobTypes/githubJob").GitHubJobClass;
const S3Publish = require("../jobTypes/S3Publish").S3PublishClass;
const validator = require("validator");
const fs = require("fs-extra");
const Logger = require("./logger").LoggerClass;
const buildTimeout = 60 * 450;
const { MongoClient } = require("mongodb");
const mongo = require("./mongo");
const EnvironmentClass = require("./environment").EnvironmentClass;
const dbName = EnvironmentClass.getDB();
const invalidJobDef = new Error("job not valid");
const collName = "queue";

// Get username password credentials
const username = encodeURIComponent(EnvironmentClass.getAtlasUsername());
const password = encodeURIComponent(EnvironmentClass.getAtlasPassword());

async function insertJob(payloadObj, userArg, emailArg) {
  // create the new job document
  const newJob = {
    title: "Regression Test",
    user: userArg,
    email: emailArg,
    status: "inQueue",
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    numFailures: 0,
    failures: [],
    result: null,
    payload: payloadObj,
    logs: {}
  };

  return new Promise(function(resolve, reject) {
    const filterDoc = {
      payload: payloadObj,
      status: { $in: ["inProgress", "inQueue"] }
    };
    const updateDoc = { $setOnInsert: newJob };

    const uri = `mongodb+srv://${username}:${password}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, {
      useUnifiedTopology: true,
      useNewUrlParser: true
    });
    client.connect(err => {
      if (err) {
        console.error("error connecting to Mongo");
        reject(err);
      }
      const collection = client.db(dbName).collection(collName);

      collection.updateOne(filterDoc, updateDoc, { upsert: true }).then(
        result => {
          if (result.upsertedId) {
            console.log(
              `You successfully enqued a staging job to docs autobuilder. This is the record id: ${result.upsertedId}`
            );
            return resolve(result.upsertedId);
          }
          console.log("This job already exists ");
          return reject("Already Existed");
        },
        error => {
          console.error(
            `There was an error enqueing a staging job to docs autobuilder. Here is the error: ${error}`
          );
          return reject(error);
        }
      );
      client.close();
    });
  });
}

function evaluateJobArrays(reposApprovedForTesting, completedJobs) {
  let completedJobCounter = 0;
  let arraysAreEqual = false;

  reposApprovedForTesting.forEach(function(repository) {
    console.log(repository.name);
    if (completedJobs.includes(repository.name)) {
      completedJobCounter++;
      if (completedJobCounter === reposApprovedForTesting.length) {
        arraysAreEqual = true;
      }
    }
  });

  return arraysAreEqual;
}

async function monitorAndCreateChildJobs(currentJob, reposApprovedForTesting) {
  const uri = `mongodb+srv://${username}:${password}@cluster0-ylwlz.mongodb.net/test?retryWrites=true&w=majority`;
  const client = new MongoClient(uri, {
    useUnifiedTopology: true,
    useNewUrlParser: true
  });

  return new Promise(async function(resolve, reject) {
    client.connect(async function(err) {
      if (err) {
        console.error("error connecting to Mongo");
        reject(err);
      }
      const db = client.db(dbName);
      const collection = db.collection(collName);

      const changeStream = collection.watch(
        [
          {
            $match: {
              $and: [
                { "fullDocument.title": "Regression Test" },
                { operationType: "update" }
              ]
            }
          }
        ],
        {
          fullDocument: "updateLookup"
        }
      );

      let completedChildJobs = [];
      changeStream.on("change", (updatedJob, error) => {
        if (error) {
          console.log("error ", error);
          throw error;
        }
        //def set a var here
        var idEquality =
           updatedJob.fullDocument.payload.parentID.toString() ===
           currentJob._id.toString();
        if (
          idEquality &&
          updatedJob.fullDocument["status"] != "inProgress" &&
          updatedJob.fullDocument["status"] != "inQueue"
        ) {
          completedChildJobs.push(updatedJob.fullDocument.payload.repoName);
          var result = evaluateJobArrays(
            reposApprovedForTesting,
            completedChildJobs
          );

          if (evaluateJobArrays(reposApprovedForTesting, completedChildJobs)) {
            resolve(true);
          }
        }
      });

      var stagePayloads = [];

      reposApprovedForTesting.forEach(function(repository) {
        stagePayloads.push(
          createPayload(
            repository["name"],
            repository["owner"],
            "nothing",
            "githubPush",
            currentJob["_id"], 
            currentJob["payload"]["newHead"], 
          )
        );
      });

      let poolTestJobs = [];
      let poolJobs = [];

      /*insert jobs */
      for (const payload of stagePayloads) {
        const testResult = insertJob(payload, currentJob["user"], currentJob["email"],);
      }
    });
  });
}

function createPayload(
  repoNameArg,
  repoOwnerArg,
  urlArg,
  typeOfJob,
  parentArg, 
  commitHash, 
) {
  const payload = {
    jobType: typeOfJob,
    source: "github",
    action: "push",
    repoName: repoNameArg,
    branchName: "master",
    parentID: parentArg,
    isFork: true,
    private: false,
    isXlarge: false,
    repoOwner: repoOwnerArg,
    url: `https://github.com/${repoOwnerArg}/${repoNameArg}`,
    newHead: commitHash
  };

  return payload;
}

module.exports = {
  createPayload,
  insertJob,
  monitorAndCreateChildJobs
};
