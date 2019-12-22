const workerUtils = require('../utils/utils');
const validator = require('validator');
const mongo = require('../utils/mongo');
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

// retrieve the target map to upload to fastly
async function getTargetMap() {
  return mongo.getDochubArray();
}

async function filtermap(map) {
  let filteredMap = [];
  map.forEach(element => {
    let page = 'https://dochub.mongodb.org/core/' + element.name;
    if (workerUtils.validateUrl(page)) {
      filteredMap.push(element);
    }
  });
  return filteredMap;
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

  if (EnvironmentClass.getFastlyToken() === undefined) {
    workerUtils.logInMongo(currentJob, 'missing env variable: fastly token');
    throw invalidEnvironment;
  }

  if (
    !currentJob ||
    !currentJob.payload ||
    !currentJob.payload.source ||
    !currentJob.payload.target ||
    !currentJob.payload.email
  ) {
    workerUtils.logInMongo(
      currentJob,
      `${'(DOCHUB)'.padEnd(15)}failed due to insufficient definition`
    );
    throw invalidJobDef;
  }

  let map = await getTargetMap();
  if (map === undefined) {
    console.log('no docs in map');
    workerUtils.logInMongo(
      currentJob,
      `${'(DOCHUB)'.padEnd(15)}failed due to no targets defined`
    );
    throw invalidJobDef;
  }

  map = await filtermap(map);
  if (map === undefined) {
    workerUtils.logInMongo(
      currentJob,
      `${'(DOCHUB)'.padEnd(15)}failed due to no valid targets`
    );
    throw invalidJobDef;
  }

  const job = new FastlyJob(currentJob);
  await job.connectAndUpsert(map).catch(err => {
    console.log('could not complete map');
    workerUtils.logInMongo(currentJob, `could not complete map ${err}`);
  });
}

module.exports = {
  runPublishDochub,
  safePublishDochub,
  filtermap,
  getTargetMap
};
