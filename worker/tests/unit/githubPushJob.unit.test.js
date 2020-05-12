const job = require('../../jobTypes/githubPushJob');
const GitHubJob = require('../../jobTypes/githubJob').GitHubJobClass;
const workerUtils = require('../../utils/utils');

var fs = require('fs');
var dir = './repos';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

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

const payloadNoBranch = {
  repoName: 'docs_build_test',
  repoOwner: 'mongodb',
  isXlargs: false
};

const payloadDevhubContent = {
  repoName: 'docs_build_test', 
  repoOwner: 'mongodb',
  branchName: 'DOCSP-test',
  isXlarge: true
}

const testPayloadWithRepo = {
  payload: payloadObj
};

const testPayloadWithoutBranch = {
  payload: payloadNoBranch
};

const testPayloadBadRepo = {
  payload: payloadObjBadRepo
};

const testPayloadBadBranch = {
  payload: payloadObjBadBranch
};

const testPayloadBadOwner = {
  payload: payloadObjBadOwner
};

const testPayloadWithDevhubRepo = {
  payload: payloadDevhubContent
}
const error = new Error('job not valid');

/** these tests focus on exec-heavy operations of the githubpush worker */

describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    jest.useFakeTimers();
    jest.setTimeout(30000)
  });

//  Tests for build() function

  it('build() rejects properly killed', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    workerUtils.getExecPromise = jest.fn().mockReturnValue(execMock);
    await expect(job.runGithubPush(testPayloadWithRepo)).rejects.toEqual({
      killed: true
    });
  });

  it('build() rejects properly code', async () => {
    const execMock = jest.fn().mockRejectedValue({ code: true });
    workerUtils.getExecPromise = jest.fn().mockReturnValue(execMock);
    await expect(job.runGithubPush(testPayloadWithRepo)).rejects.toEqual({
      code: true
    });
  });

  it('build() rejects properly signal', async () => {
    const execMock = jest.fn().mockRejectedValue({ signal: true });
    workerUtils.getExecPromise = jest.fn().mockReturnValue(execMock);
    await expect(job.runGithubPush(testPayloadWithRepo)).rejects.toEqual({
      signal: true
    });
  });
  
  //test
  it('buildRepo() rejects', async () => {

    const devhubjob = new GitHubJob(testPayloadWithDevhubRepo);
    devhubjob.cleanup = jest.fn().mockResolvedValue();
    devhubjob.cloneRepo = jest.fn().mockResolvedValue();

    //mock first exec call
    const execMock = jest.fn().mockResolvedValueOnce({stdout: 'success!!', stderr: ''});
    workerUtils.getExecPromise = jest.fn().mockReturnValueOnce(() => execMock)

    devhubjob.downloadMakefile = jest.fn().mockReturnValueOnce(Promise.resolve({status: 'success', content: 'makefile'}))
    
    //mock second exec call
    const mockError2 = new Error({code: 2})
    const execMock2 = jest.fn().mockResolvedValueOnce(mockError2)
    workerUtils.getExecPromise = jest.fn().mockReturnValueOnce(() => execMock2);
    
    await expect(job.runGithubPush(testPayloadWithDevhubRepo)).rejects.toThrow(mockError2); 
  });

  it('build() resolves properly notsignal', async () => {
    const execMock = jest.fn().mockRejectedValue({ notSignal: true });
    workerUtils.getExecPromise = jest.fn().mockReturnValue(execMock);
    await expect(
      job.runGithubPush(testPayloadWithRepo)
    ).rejects.toEqual({
      notSignal: true
    });
  });

  // Tests for RunGithubPush Function
  it('runGithubPush(): no repository name --> should fail to run', async () => {
    job.build = jest.fn().mockRejectedValue(error);
    await expect(job.runGithubPush({})).rejects.toEqual(error);
    jest.runAllTimers();
    expect(job.build).toHaveBeenCalledTimes(0);
  });

  it('runGithubPush(): no branch name --> should fail to run', async () => {
    job.build = jest.fn().mockRejectedValue(error);
    await expect(job.runGithubPush(testPayloadWithoutBranch)).rejects.toEqual(
      error
    );
    jest.runAllTimers();
    expect(job.build).toHaveBeenCalledTimes(0);
  });

  it('runGithubPush(): If build fails --> should reject', async () => {
    job.build = jest.fn().mockRejectedValue('build failed');
    job.cleanup = jest.fn().mockResolvedValue();
    job.cloneRepo = jest.fn().mockResolvedValue();

    await expect(job.runGithubPush({})).rejects.toEqual(error);

    expect(job.cloneRepo).toHaveBeenCalledTimes(0);
    expect(job.cleanup).toHaveBeenCalledTimes(0);
  });

  //sanitize
  it('sanitize(): If repo invalid --> should reject', async () => {
    job.safeGithubPush = jest.fn().mockRejectedValue(error);
    await expect(job.safeGithubPush(testPayloadBadRepo)).rejects.toEqual(error);
  });

  it('sanitize(): If branch invalid --> should reject', async () => {
    await expect(job.safeGithubPush(testPayloadBadBranch)).rejects.toEqual(
      error
    );
  });
  it('sanitize(): If owner invalid --> should reject', async () => {
    await expect(job.safeGithubPush(testPayloadBadOwner)).rejects.toEqual(
      error
    );
  });
 });
