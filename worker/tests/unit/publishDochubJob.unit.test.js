const job = require('../../jobTypes/publishDochubJob');
const workerUtils = require('../../utils/utils');
const EnvironmentClass = require('../../utils/environment').EnvironmentClass;

const payloadObj = {
  source: 'someSource',
  target: 'someTarget',
};

const payloadObjBadSource = {
  sourcebad: 'some source',
  target: 'someTarget'
};

const payloadObjBadTarget = {
  source: 'someSource',
  targetbad: 'some target'
};

const payloadNoEmail = {
  source: 'someSource',
  target: 'someTarget'
};

const testPayloadGood = {
  payload: payloadObj,
  email: 'testemail'
};

const testPayloadWithoutEmail = {
  payload: payloadNoEmail
};

const testPayloadBadSource = {
  payload: payloadObjBadSource,
  email: 'testemail'
};

const testPayloadBadTarget = {
  payload: payloadObjBadTarget,
  email: 'testemail'
};

const error = new Error('job not valid');

describe('Test Class', () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    EnvironmentClass.setFastlyToken('test');
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    jest.useFakeTimers();
  });

  // Tests for RunPublishDochub Function

  it('runPublishDochub() rejects lack of map', async () => {
    expect(job.safePublishDochub(testPayloadGood)).toBeTruthy();
  });

  it('runPublishDochub(): no email --> should fail to run', async () => {
    await expect(job.runPublishDochub(testPayloadWithoutEmail)).rejects.toEqual(
      error
    );
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
