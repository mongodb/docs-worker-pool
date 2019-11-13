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

  // fastly.request('GET', '/content/edge_check?url=docs.mongodb.com', function (err, obj) {
  fastly.request('GET', '/service/0U4FLNfta0jDgmrSFA193k/version/35/dictionary/redirect_map', function (err, obj) {
    if (err) return console.dir(err);
    console.dir(obj);
  });
}

module.exports = {
  runPublishDochub,
  safePublishDochub,
};