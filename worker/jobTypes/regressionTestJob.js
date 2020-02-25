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
  /*create jobs for testing*/
  let fileContents;
  let reposApprovedForTesting;

  /*Staging*/
  try {
    fileContents = fs.readFileSync("./json/supported-docs-repos.json", "utf8");
  } catch (err) {
    const errorReadFile = new Error("error reading file: ", err);
    throw errorReadFile;
  }

  try {
    reposApprovedForTesting = JSON.parse(fileContents)["repos"];
  } catch (error) {
    const errorParsingJson = new Error("error parsing json: ", error);
  }

  /*open change stream so we can make sure we are monitoring all regression jobs */
  return new Promise(async function(resolve, reject) {
    const result = await regressionUtils.monitorAndCreateChildJobs(currentJob, reposApprovedForTesting);
    if (result) {
      resolve();
    }
    reject();
  });
}

module.exports = {
  safeRegressionTest,
  runRegressionTests
};
