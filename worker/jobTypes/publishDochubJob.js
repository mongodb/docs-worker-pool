const workerUtils = require('../utils/utils');
const validator = require('validator');

const invalidJobDef = new Error('job not valid');
const FastlyJob = require('../jobTypes/fastlyJob').FastlyJobClass

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
    !currentJob.payload.target ||
    !currentJob.email
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

async function startFastly(job) {
  // retrieve Fastly service
  var fastly = require('fastly')(`${process.env.FASTLY_TOKEN}`)

  // connect to MongoDB dochub database
  const MongoClient = require("mongodb").MongoClient;
  assert = require("assert")

  job.connectAndUpsert(MongoClient, fastly, "dochub", "keys");
}

async function runPublishDochub(currentJob) {

  workerUtils.logInMongo(currentJob, ' ** Running dochub-fastly migration');

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.source ||
    !currentJob.payload.target ||
    !currentJob.payload.email
  ) {
    workerUtils.logInMongo(currentJob,`${'(BUILD)'.padEnd(15)}failed due to insufficient definition`);
    throw invalidJobDef;
  }

  const job = new FastlyJob(currentJob);

  await startFastly(job);
}

module.exports = {
  runPublishDochub,
  safePublishDochub,
};