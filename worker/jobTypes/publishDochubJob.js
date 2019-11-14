const fs = require('fs-extra');
const workerUtils = require('../utils/utils');
// const DochubJob = require('../jobTypes/dochubJob').DochubJobClass;
const validator = require('validator');

const invalidJobDef = new Error('job not valid');

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

  // instantiate dochub job class
  // const job = new DochubJob(currentJob);

    // add source and target to Fastly edge dictionary
  var fastly = require('fastly')('6aRkvo3EJN7N2JLJcZdOaS7AxFKMu6qq') // put this token elsewhere!

  const options = {
    name: "redirect_map"
  }
  // fastly.request('GET', '/content/edge_check?url=docs.mongodb.com', function (err, obj) {
  fastly.request('GET', '/service/0U4FLNfta0jDgmrSFA193k/version/36/dictionary', options, function (err, obj) {
    if (err) return console.dir(err);
    console.dir(obj);
  });

  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
  var request = new XMLHttpRequest();

  // connect to MongoDB dochub database
  const MongoClient = require("mongodb").MongoClient;
  assert = require("assert")

  // connection url - PUT USERNAME/PASSWORD ELSEWHERE
  const url = 'mongodb+srv://varsha:gypsh3K0mL55Nl7w@cluster0-ylwlz.mongodb.net/dochub?authSource=admin';

  MongoClient.connect(url, function(err, client) {
    assert.equal(null, err);

    const db = client.db("dochub");

    var cursor = db.collection('keys').find({});

    function iterateFunc(doc) {
      page = "https://dochub.mongodb.org/core/" + doc.name;
      console.log(JSON.stringify(doc, null, 4));
    }

    function errorFunc(error) {
      console.log(error);
    }

    cursor.forEach(iterateFunc, errorFunc);


    client.close();
  });


  var page = "http://www.googlevaralsdj.com";
  request.open("GET", page, false);
  request.send()
  if (request.status === 200) {
    console.log("real page: ", page)
  } else {
    console.log("fake page: ", page)
  }

  const new_options = {
    item_key: page,
    item_value: "Fake Google"
  }

  // dictionary_id: 5dNt5O5Kr6cD6eIbkexmbb
  fastly.request('POST', '/service/0U4FLNfta0jDgmrSFA193k/dictionary/5dNt5O5Kr6cD6eIbkexmbb/item', new_options, function (err, obj) {
    if (err) return console.dir(err);
    console.dir(obj);
  });

  fastly.request('GET', '/service/0U4FLNfta0jDgmrSFA193k/version/36/dictionary', options, function (err, obj) {
    if (err) return console.dir(err);
    console.dir(obj);
  });

  // fastly.request('GET', '/service/0U4FLNfta0jDgmrSFA193k/version/36/dictionary/redirect_map', function (err, obj) {
  //   if (err) return console.dir(err);
  //   console.dir(obj);
  // });
}

module.exports = {
  runPublishDochub,
  safePublishDochub,
};