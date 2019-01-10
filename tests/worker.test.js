const worker = require('../worker');
const mongo = require('../utils/mongo');
const workerUtils = require('../utils/utils');
const githubPushJob = require('../jobTypes/githubPushJob');

describe('Test Class', () => {
    beforeAll(() => {
      workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    });

    /********************************************************************
     *                          livenessCheck()                         *
     ********************************************************************/
    it('livenessCheck()', async() => {
      await expect(worker.livenessCheck()).resolves.toBeUndefined();

      worker.setLive(false);
      await expect(worker.livenessCheck()).rejects.toEqual("Server Failed To Startup");

      worker.setLive(true);
      oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 5);
      worker.setLastCheckin(oldDate);
      await expect(worker.livenessCheck()).rejects.toBeTruthy();
      
      worker.setLastCheckin(new Date());
    });

    /********************************************************************
     *                          readinessCheck()                        *
     ********************************************************************/
    it('readinessCheck()', async() => {
      expect(worker.readinessCheck()).rejects.toEqual("Not Yet Ready");
    });

    /********************************************************************
     *                          startServer()                           *
     ********************************************************************/
    it('startServer()', async() => {
      mongo.initMongoClient = jest.fn().mockResolvedValue();
      await expect(worker.startServer()).resolves.toBeUndefined();
    });

    /********************************************************************
     *                            onSignal()                            *
     ********************************************************************/
    it('onSignal()', async() => {
      worker.setCurrentJob({job: "doesnt matter"});
      workerUtils.promiseTimeoutS = jest.fn().mockResolvedValue();
      mongo.finishJobWithFailure = jest.fn().mockResolvedValue();


      await expect(worker.onSignal()).resolves.toBeUndefined();
      expect(mongo.finishJobWithFailure).toHaveBeenCalledTimes(1);

      worker.setCurrentJob(null);
    });
});