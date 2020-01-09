/** ******************************************************************
 *                  Sample Class for Testing                       *
 ******************************************************************* */

// const job = require('../jobTypes/githubPushJob');
const workerUtils = require("../../utils/utils");
const productionDeployJob = require("../../jobTypes/productionDeployJob");
const mongo = require("../../utils/mongo");
const { MongoClient } = require("mongodb");
const S3Publish = require("../../jobTypes/S3Publish").S3PublishClass;
const GitHubJob = require("../../jobTypes/githubJob").GitHubJobClass;
const Logger = require("../../utils/logger").LoggerClass;

const testJob = {
  user: "madelinezec",
  payload: {
    jobType: "productionDeploy",
    repoOwner: "madelinezec",
    repoName: "docs-bi-connector",
    branchName: "master"
  },
  startTime: null,
  endTime: null,
  priority: 2,
  status: "inQueue",
  numFailures: 0,
  failures: [],
  result: null,
  logs: {}
};

const notPublishableJob = {
  user: "madelinezec",
  payload: {
    jobType: "productionDeploy",
    repoOwner: "madelinezec",
    repoName: "docs-bi-connector",
    branchName: "not-publishable-branch"
  },
  startTime: null,
  endTime: null,
  priority: 2,
  status: "inQueue",
  numFailures: 0,
  failures: [],
  result: null,
  logs: {}
};

const badEntitlementsJob = {
  user: "billyjoel",
  payload: {
    jobType: "productionDeploy",
    repoOwner: "madelinezec",
    repoName: "docs-bi-connector",
    branchName: "not-publishable-branch"
  },
  startTime: null,
  endTime: null,
  priority: 2,
  status: "inQueue",
  numFailures: 0,
  failures: [],
  result: null,
  logs: {}
};

const unsafeJob = {
  user: "madelinezec",
  payload: {
    jobType: "productionDeploy",
    repoOwner: "madelinezec",
    repoName: "docs-bi-connector"
  },
  startTime: null,
  endTime: null,
  priority: 2,
  status: "inQueue",
  numFailures: 0,
  failures: [],
  result: null,
  logs: {}
};
const gitHubUser = "madelinezec";

const job = new GitHubJob(testJob);

describe("ProductionDeploy Test Class", () => {
  let connection;
  let db;
  beforeAll(async () => {
    connection = await MongoClient.connect(global.__MONGO_URI__, {
      useNewUrlParser: true
    });
    db = await connection.db(global.__MONGO_DB_NAME__);
    //do I need to add repos for entitlements collection???
    const jobsColl = db.collection("jobs");
    await jobsColl.insertMany([testJob]);
  });
  afterAll(() => {});

  beforeEach(() => {});

  afterEach(() => {});

  //User Has Entitlements
  it("verifyUserEntitlements", async () => {
    workerUtils.getUserEntitlements = jest
      .fn()
      .mockReturnValue({
        status: "success",
        repos: "madelinezec/docs-bi-connector"
      });

    const userCheck = await productionDeployJob.verifyUserEntitlements(testJob);
    expect(userCheck).toBeTruthy();
  });

  //Branch is configured for publish
  it("verifyBranchConfiguredForPublish", async () => {
    const branchCheck = await productionDeployJob.verifyBranchConfiguredForPublish(
      testJob
    );
    expect(branchCheck).toBeTruthy();
  });

  //TODO pushToProduction
  it("pushToProduction", async () => {
    const publisher = new S3Publish(job);
    const logger = new Logger(testJob);

    job.cloneRepo = jest.fn().mockResolvedValue();
    job.buildRepo = jest.fn().mockResolvedValue();
    workerUtils.promiseTimeoutS = jest
      .fn()
      .mockReturnValue({ status: "success" });
    publisher.pushToProduction = jest.fn().mockResolvedValue({
      status: "success",
      stdout: "Summary"
    });
    const jobsColl = db.collection("jobs");
    mongo.getQueueCollection = jest.fn().mockReturnValue(jobsColl);

    await expect(
      productionDeployJob.pushToProduction(publisher, logger)
    ).resolves.toBeTruthy();
  });

  //Not Publishable
  it("runGitHubProdPush", async () => {
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    job.cloneRepo = jest.fn().mockResolvedValue();
    const err = new Error("entitlement failed");

    await expect(
      productionDeployJob.runGithubProdPush(notPublishableJob).catch(e => {
        console.log("State: ", wrapper.state());
        expect(e).toEqual(err);
      })
    );
  });

  //User Does Not Have Entitlements --> runGitHubProdPush fails
  it("runGitHubProdPush", async () => {
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    job.cloneRepo = jest.fn().mockResolvedValue();
    const err = new Error("entitlement failed");
    await expect(
      productionDeployJob.runGithubProdPush(badEntitlementsJob).catch(e => {
        console.log("State: ", wrapper.state());
        expect(e).toEqual(err);
      })
    );
  });

  it("safeGithubPush()", () => {
    const err = new Error("job not valid");
    expect(() => productionDeployJob.safeGithubProdPush(unsafeJob)).toThrow(
      err
    );
  });
});
