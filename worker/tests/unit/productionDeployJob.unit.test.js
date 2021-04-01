const deployjob = require('../../jobTypes/productionDeployJob');
const workerUtils = require('../../utils/utils');
const GitHubJob = require('../../jobTypes/githubJob').GitHubJobClass;
const Logger = require('../../utils/logger').LoggerClass

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
    this.githubJob = new GitHubJob(testPayloadWithRepo);
    this.githubJob.buildRepo = jest.fn().mockReturnValueOnce({
      status: 'success',
      stdout: null,
      stderr: null,
    });
    this.logger = new Logger(this.githubJob)
    this.logger.filterOutputForUserLogs = jest.fn().mockReturnValueOnce({
      status: 'success',
      stdout: null,
      stderr: null,
    });
    this.logger.save = jest.fn().mockReturnValueOnce({});
    jest.useFakeTimers();
  });

  it('startGithubBuild(: If build is successful --> return true', async () => {
    await expect(deployjob.startGithubBuild(this.githubJob, this.logger)).toBeTruthy()
  });
});
