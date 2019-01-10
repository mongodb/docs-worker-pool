const worker = require('../worker');
const mongo = require('../utils/mongo');
const workerUtils = require('../utils/utils');
const githubPushJob = require('../jobTypes/githubPushJob');

describe('Test Class', () => {
    beforeAll(() => {
      workerUtils.resetDirectory = jest.fn().mockResolvedValue();
      workerUtils.logInMongo = jest.fn().mockResolvedValue();
    });

    /********************************************************************
     *                          startServer()                           *
     ********************************************************************/
    it('startServer()', async() => {
      mongo.initMongoClient = jest.fn().mockResolvedValue();
      await expect(worker.startServer()).resolves.toBeUndefined();
    });

    /********************************************************************
     *                          gracefulShutdown()                      *
     ********************************************************************/
    it('onSignal()', async() => {
      worker.setCurrentJob({job: "doesnt matter"});
      workerUtils.promiseTimeoutS = jest.fn().mockResolvedValue();
      mongo.finishJobWithFailure = jest.fn().mockResolvedValue();


      await expect(worker.gracefulShutdown()).resolves.toBeUndefined();
      expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);

      worker.setCurrentJob(null);
    });
});