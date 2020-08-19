const job = require('../../jobTypes/productionDeployJob');
const workerUtils = require('../../utils/utils');
const githubJob = require('../../jobTypes/githubJob');

const payloadObj = {
    repoName: 'docs_build_test',
    branchName: 'DOCSP-test',
    repoOwner: 'mongodb'
  };
  
  const payloadObjBadRepo = {
    repoName: 'docs_build_test;',
    branchName: 'DOCSP-test',
    repoOwner: 'mongodb',
    isXlarge: false
  };
  
  const payloadObjBadBranch = {
    repoName: 'docs_build_test',
    branchName: 'DOCSP-test(); ',
    repoOwner: 'mongodb',
    isXlarge: false
  };
  
  const payloadObjBadOwner = {
    repoName: 'docs_build_test',
    branchName: 'DOCSP-test',
    repoOwner: 'mongodb; ls',
    isXlarge: false
  };

  const testPayloadBadBranch = {
    payload: payloadObjBadBranch
  };
  
  const testPayloadBadOwner = {
    payload: payloadObjBadOwner
  }

const error = new Error('job not valid');

describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    githubJob.buildRepo = jest.fn().mockReturnValueOnce({
        status: 'success',
        stdout: stdout,
        stderr: stderr
    })
    jest.useFakeTimers();
  });

  // Sanitize

  it('sanitize(): If branch invalid --> should reject', async () => {
    let thrownError;
    try {
      job.safePublishDochub(testPayloadBadBranch);
    } catch (e) {
      thrownError = e;
    }
    await expect(thrownError).toEqual(error);
  });

  it('sanitize(): If target invalid --> should reject', async () => {
    let thrownError;
    try {
      job.safePublishDochub(testPayloadBadOwner);
    } catch (e) {
      thrownError = e;
    }
    await expect(thrownError).toEqual(error);
  });

  it('startGithubBuild(: If build is successful --> return true', async () => {
      await expect(job.startGithubBuild(null, null)).toEqual(true);
    });


});
