const workerUtils = require('../utils/utils');
const validator = require('validator');
const invalidJobDef = new Error('job not valid');
const invalidEnvironment = new Error(
  'environment variables missing for jobtype'
);
const FastlyJob = require('../utils/fastlyJob').FastlyJobClass;
const EnvironmentClass = require('../utils/environment').EnvironmentClass;

//anything that is passed to an exec must be validated or sanitized
//we use the term sanitize here lightly -- in this instance this // ////validates
function safeString(stringToCheck) {
  return validator.isAscii(stringToCheck);
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

async function runPublishDochub(currentJob) {
  workerUtils.logInMongo(currentJob, ' ** Running dochub-fastly migration');

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.source ||
    !currentJob.payload.target ||
    !currentJob.email
  ) {
    workerUtils.logInMongo(
      currentJob,
      `${'(DOCHUB)'.padEnd(15)}failed due to insufficient definition`
    );
    throw invalidJobDef;
  }

  if (EnvironmentClass.getFastlyToken() === undefined) {
    workerUtils.logInMongo(currentJob, 'missing env variable: fastly token');
    throw invalidEnvironment;
  }

  let map = {
    'source': currentJob.payload.source,
    'target': currentJob.payload.target
  };

  if (map === undefined) {
    workerUtils.logInMongo(
      currentJob,
      `${'(DOCHUB)'.padEnd(15)}failed due to no targets defined`
    );
    throw invalidJobDef;
  }
  
  const initFastly = new FastlyJob(currentJob);
  await initFastly.connectAndUpsert(map, EnvironmentClass.getFastlyDochubServiceId()).then().catch (err => {
    workerUtils.logInMongo(currentJob, `could not complete map ${err}`);
    throw invalidEnvironment;
  });
}

module.exports = {
  runPublishDochub,
  safePublishDochub
};
