const fs = require("fs-extra");
const workerUtils = require("../utils/utils");
const simpleGit = require("simple-git/promise");
const request = require("request");
const regressionUtils = require("../utils/regressionTestUtils");
const { MongoClient } = require("mongodb");

function safeRegressionTest(currentJob) {
  if (currentJob.repoName != "snooty-regression-tests") {
    return;
  }
}

async function runRegressionTests(currentJob) {
  /*open change stream so we can make sure we are monitoring all regression jobs */
  return new Promise(async function(resolve, reject) {
    const result = await regressionUtils.changeStream(currentJob);
    if (result === true){
      resolve()
    }
    reject()
  });
}

module.exports = {
  safeRegressionTest,
  runRegressionTests
};
