const job = require('../../jobTypes/githubPushJob');
const workerUtils = require('../../utils/utils');

const fs = require('fs-extra');

const payloadObj = {
  repoName: 'docs_build_test',
  branchName: 'DOCSP-test',
  repoOwner: 'mongodb',
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
    await expect(job.runGithubPush(testPayloadWithRepo)).resolves.toBeDefined();
  });
});
