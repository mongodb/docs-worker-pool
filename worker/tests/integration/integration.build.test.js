const job = require('../../jobTypes/githubPushJob');
const workerUtils = require('../../utils/utils');

const fs = require('fs-extra');

const payloadObj = {
  repoName: 'docs_build_test',
  branchName: 'DOCSP-test',
  newHead: '123',
  repoOwner: 'mongodb',
  isXlarge: false
};

const payloadNoBranch = {
  repoName: 'docs_build_test',
  repoOwner: 'mongodb',
};

const testPayloadWithRepo = {
  payload: payloadObj,
};

const error = new Error('branch name not indicated');

/** these are integration tests */
describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
  });

  it('integration build', async () => {
    jest.setTimeout(300000);
    // comment out for now until we resolve docker command issue
    //await expect(job.runGithubPush(testPayloadWithRepo)).resolves.toBeDefined();
  });
});
