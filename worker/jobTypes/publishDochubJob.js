const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
// const DochubJob = require('../jobTypes/dochubJob').DochubJobClass;
const validator = require('validator');

const invalidJobDef = new Error('job not valid');
const mongo = require('../utils/mongo');

//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(stringToCheck) {
  return (
    validator.isAscii(stringToCheck) &&
    validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
  );
}

function safePublishDochub(currentJob) {
  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.source ||
    !currentJob.payload.target
  ) {
    workerUtils.logInMongo(
      currentJob,
      `${'    (sanitize)'.padEnd(15)}failed due to insufficient job definition`
    );
    throw invalidJobDef;
  }

  if (
    safeString(currentJob.payload.source) &&
    safeString(currentJob.payload.target)
  ) {
    return true;
  }
  throw invalidJobDef;
}

async function runPublishDochub(currentJob) {

  workerUtils.logInMongo(currentJob, ' ** Running dochub-fastly migration');

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.source ||
    !currentJob.payload.target
  ) {
    workerUtils.logInMongo(currentJob,`${'(BUILD)'.padEnd(15)}failed due to insufficient definition`);
    throw invalidJobDef;
  }

  // retrieve Fastly service
  var fastly = require('fastly')(`${process.env.FASTLY_TOKEN}`)

  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
  var req = new XMLHttpRequest();

  // connect to MongoDB dochub database
  const MongoClient = require("mongodb").MongoClient;
  assert = require("assert")

  const url = `mongodb+srv://${process.env.MONGO_ATLAS_USERNAME}:${process.env.MONGO_ATLAS_PASSWORD}@cluster0-ylwlz.mongodb.net/dochub?authSource=admin`;
  
  MongoClient.connect(mongo.url, function(err, client) {
    assert.equal(null, err);

    const db = client.db("dochub");

    var cursor = db.collection('keys').find({});

    function iterateFunc(doc) {
      const page = "https://dochub.mongodb.org/core/" + doc.name;
      var request = require('request');
      var r = request.get(page, function(err, res, body) {
        if (res != null) {
          if (res.status != 404) {
            const options = {
              item_value: doc.url
            }

            fastly.request('PUT', '/service/0U4FLNfta0jDgmrSFA193k/dictionary/2FoAatLRziZlxb6aTwnRWs/item/'+doc.name, options, function (err, obj) {
              if (err) return console.dir(err);
              console.dir(obj);
            });
          } else {
            console.log("Bad URL: ", page, res.status);
          }
        }
      });
    }

    function errorFunc(error) {
      console.log(error);
    }

    cursor.forEach(iterateFunc, errorFunc);


    client.close();
  });
}

module.exports = {
  runPublishDochub,
  safePublishDochub,
};