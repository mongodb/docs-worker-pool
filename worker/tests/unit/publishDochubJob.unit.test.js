const job = require("../../jobTypes/publishDochubJob");
const workerUtils = require("../../utils/utils");
const mongo = require("../../utils/mongo");

const payloadObj = {
  source: "someSource",
  target: "someTarget",
  email: "email@gmail.com"
};

const payloadObjBadSource = {
  source: "some source",
  target: "someTarget"
};

const payloadObjBadTarget = {
  source: "someSource",
  target: "some target"
};

const payloadNoSource = {
  target: "someTarget"
};

const payloadNoTarget = {
  source: "someSource"
};

const payloadNoEmail = {
  source: "someSource",
  target: "someTarget"
};

const testPayloadGood = {
  payload: payloadObj
};

const testPayloadWithoutEmail = {
  payload: payloadNoEmail
};

const testPayloadBadSource = {
  payload: payloadObjBadSource
};

const testPayloadBadTarget = {
  payload: payloadObjBadTarget
};

const doc = [
  {
    _id: { $oid: "4db32eacdbd1ff5a7a24ff17" },
    url: "http://www.mongodb.org/display/DOCS/Collections",
    name: "collections"
  }
];

const error = new Error("job not valid");

describe("Test Class", () => {
  // Dont actually reset the directory and dont care about the logging
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
    jest.useFakeTimers();
  });

  // Tests for dochubpublish() function

  it("runPublishDochub() rejects properly killed", async () => {
    mongo.getDochubArray = jest.fn().mockResolvedValue(doc);
    expect(await job.runPublishDochub(testPayloadGood)).toBeUndefined();
  });
  // Tests for RunPublishDochub Function

  it("runPublishDochub() rejects lack of map", async () => {
    mongo.getDochubArray = jest.fn().mockResolvedValue(undefined);
    let thrownError;
    try {
      job.safePublishDochub(testPayloadGood).toBeCalled();
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toEqual(error);
  });

  it("runPublishDochub(): no email --> should fail to run", async () => {
    job.build = jest.fn().mockRejectedValue(error);
    await expect(job.runPublishDochub(testPayloadWithoutEmail)).rejects.toEqual(
      error
    );
    jest.runAllTimers();
    expect(job.build).toHaveBeenCalledTimes(0);
  });

  // Sanitize

  it("sanitize(): If source invalid --> should reject", async () => {
    let thrownError;
    try {
      job.safePublishDochub(testPayloadBadSource);
    } catch (e) {
      thrownError = e;
    }
    await expect(thrownError).toEqual(error);
  });

  it("sanitize(): If target invalid --> should reject", async () => {
    let thrownError;
    try {
      job.safePublishDochub(testPayloadBadTarget);
    } catch (e) {
      thrownError = e;
    }
    await expect(thrownError).toEqual(error);
  });
});
