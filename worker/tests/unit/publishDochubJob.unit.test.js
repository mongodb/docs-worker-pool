const job = require('../../jobTypes/publishDochubJob');
const workerUtils = require('../../utils/utils');

const payloadObj = {
  source: 'someSource',
  target: 'someTarget',
  email: 'email@gmail.com'
};

const payloadObjBadSource = {
  source: 'some source',
  target: 'someTarget'
};

const payloadObjBadTarget = {
  source: 'someSource',
  target: 'some target'
};

const payloadNoSource = {
  target: 'someTarget',
};

const payloadNoTarget = {
  source: 'someSource',
};

const payloadNoEmail = {
  source: 'someSource',
  target: 'someTarget'
};

const testPayloadGood = {
  payload: payloadObj,
};

const testPayloadWithoutSource = {
  payload: payloadNoSource,
};

const testPayloadWithoutTarget = {
  payload: payloadNoTarget,
};

const testPayloadWithoutEmail = {
  payload: payloadNoEmail,
};

const testPayloadBadSource = {
  payload: payloadObjBadSource,
};

const testPayloadBadTarget = {
  payload: payloadObjBadTarget,
};

const error = new Error('job not valid');


describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    jest.useFakeTimers();
    console.log(job);
  });

  // Tests for build() function

  it('build() rejects properly killed', async () => {
    const execMock = jest.fn().mockRejectedValue({ killed: true });
    workerUtils.getExecPromise = jest.fn().mockReturnValue(execMock);
    await expect(job.runPublishDochub(testPayloadGood)).resolves.toBeUndefined();
  });

  // Tests for RunPublishDochub Function

  it('runPublishDochub(): no source --> should fail to run', async () => {
    job.build = jest.fn().mockRejectedValue(error);
    await expect(job.runPublishDochub(testPayloadWithoutSource)).rejects.toEqual(
      error
    );
    jest.runAllTimers();
    expect(job.build).toHaveBeenCalledTimes(0);
  });

  it('runPublishDochub(): no target --> should fail to run', async () => {
    job.build = jest.fn().mockRejectedValue(error);
    await expect(job.runPublishDochub(testPayloadWithoutTarget)).rejects.toEqual(
      error
    );
    jest.runAllTimers();
    expect(job.build).toHaveBeenCalledTimes(0);
  });

  it('runPublishDochub(): no email --> should fail to run', async () => {
    job.build = jest.fn().mockRejectedValue(error);
    await expect(job.runPublishDochub(testPayloadWithoutEmail)).rejects.toEqual(
      error
    );
    jest.runAllTimers();
    expect(job.build).toHaveBeenCalledTimes(0);
  });

  // Sanitize

  it('sanitize(): If source invalid --> should reject', async () => {
    let thrownError;
    try {
        job.safePublishDochub(testPayloadBadSource);
    } catch (e) {
        thrownError = e;
    }
    await expect(thrownError).toEqual(error);
  });
  
  it('sanitize(): If target invalid --> should reject', async () => {
      let thrownError;
      try {
        job.safePublishDochub(testPayloadBadTarget);
      } catch (e) {
        thrownError = e;
      }
      await expect(thrownError).toEqual(error);
  });
});