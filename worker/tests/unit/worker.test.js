const worker = require('../../worker');
const mongo = require('../../utils/mongo');
const workerUtils = require('../../utils/utils');

describe('Test Class', () => {
  beforeAll(() => {
    workerUtils.resetDirectory = jest.fn().mockResolvedValue();
    workerUtils.logInMongo = jest.fn().mockResolvedValue();
  });

  /** ******************************************************************
   *                          express()                               *
   ******************************************************************* */
  it('testLiveness()', async () => {
    mongo.initMongoClient = jest.fn().mockResolvedValue();
    worker.setLastCheckIn(new Date());
    expect(worker.getLiveness().status).toEqual(200);

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 2);
    worker.setLastCheckIn(oldDate);
    expect(worker.getLiveness().status).toEqual(500);
  });

  /** ******************************************************************
   *                          startServer()                           *
   ******************************************************************* */
  it('startServer()', async () => {
    mongo.initMongoClient = jest.fn().mockResolvedValue();
    await expect(worker.startServer()).resolves.toBeTruthy();
  });

  /** ******************************************************************
   *                          gracefulShutdown()                      *
   ******************************************************************* */
  it('onSignal()', async () => {
    worker.setCurrentJob({ job: 'doesnt matter' });
    workerUtils.promiseTimeoutS = jest.fn().mockResolvedValue();
    mongo.resetJobForReenqueue = jest.fn().mockResolvedValue();

    await expect(worker.gracefulShutdown()).resolves.toBeUndefined();
    expect(mongo.resetJobForReenqueue).toHaveBeenCalledTimes(1);

    worker.setCurrentJob(null);
  });
});
