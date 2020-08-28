const deployjob = require('../../jobTypes/productionDeployJob');
const workerUtils = require('../../utils/utils');
const GitHubJob = require('../../jobTypes/githubJob').GitHubJobClass;

const payloadObj = {
  repoName: 'docs_build_test',
  branchName: 'DOCSP-test',
  repoOwner: 'mongodb',
};

const testPayloadWithRepo = {
  payload: payloadObj,
};

describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    const githubJob = new GitHubJob(testPayloadWithRepo);

    githubJob.buildRepo = jest.fn().mockReturnValueOnce({
      status: 'success',
      stdout: null,
      stderr: null,
    });
    jest.useFakeTimers();
  });

  it('startGithubBuild(: If build is successful --> return true', async () => {
    try {
      deployjob.startGithubBuild(null, null);
    } catch (e) {
      throw e;
    }
  });
});
