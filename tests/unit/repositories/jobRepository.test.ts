import { JobRepository } from '../../../src/repositories/jobRepository';
import { getBuildJobDef, getBuildJobPlain } from '../../data/jobDef';
import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';
import { ObjectId } from 'mongodb';
import { Job, JobStatus } from '../../../src/entities/job';

describe('Job Repository Tests', () => {
  let job: Job;
  let jobRepo: JobRepository;
  let dbRepoHelper: DBRepositoryHelper;
  beforeEach(() => {
    job = getBuildJobDef();
    dbRepoHelper = new DBRepositoryHelper();
    jobRepo = dbRepoHelper.init('job', 'jobQueueCollection', 'testColl');
  });

  test('Construct Job Repository', () => {
    expect(new JobRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
  });

  describe('Job Repository updateWithStatus Tests', () => {
    test('Update with completion status throws DB Error as result is undefined', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        '64ad959b423952aeb9341fad',
        'completed',
        'All good',
        new Date()
      );
      await expect(
        jobRepo.updateWithStatus('64ad959b423952aeb9341fad', 'All good', JobStatus.completed)
      ).rejects.toThrow(
        `Failed to update job (${JSON.stringify(testData.query)}) for ${JSON.stringify(testData.update)}`
      );
    });

    test('Update with completion status throws DB Error as result is undefined', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        '64ad959b423952aeb9341fad',
        'completed',
        'All good',
        new Date()
      );
      dbRepoHelper.collection.findOneAndUpdate.mockReturnValue(undefined);
      await expect(
        jobRepo.updateWithStatus('64ad959b423952aeb9341fad', 'All good', JobStatus.completed)
      ).rejects.toThrow(
        `Failed to update job (${JSON.stringify(testData.query)}) for ${JSON.stringify(testData.update)}`
      );
      expect(dbRepoHelper.collection.findOneAndUpdate).toBeCalledTimes(1);
    });

    test('Update with completion status succeeds', async () => {
      setupForFindOneAndUpdateSuccess();
      await expect(
        jobRepo.updateWithStatus('64ad959b423952aeb9341fad', 'All good', JobStatus.completed)
      ).resolves.toEqual(job);
      expect(dbRepoHelper.collection.findOneAndUpdate).toBeCalledTimes(1);
      expect(dbRepoHelper.logger.error).toBeCalledTimes(0);
    });

    test('Update with completion status timesout', async () => {
      dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
      dbRepoHelper.collection.findOneAndUpdate.mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5000, 'one');
        });
      });
      try {
        jobRepo.updateWithStatus('64ad959b423952aeb9341fad', 'All good', JobStatus.completed).catch((error) => {
          expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
          expect(error.message).toContain(
            `Mongo Timeout Error: Timed out while updating job status to "${JobStatus.completed}" for jobId: 64ad959b423952aeb9341fad`
          );
        });
        jest.runAllTimers();
      } catch (err) {}
    });
  });

  describe('Job Repository updateWithFailureStatus Tests', () => {
    test('updateWithFailureStatus succeeds', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        '64ad959b423952aeb9341fad',
        'failed',
        'All good',
        new Date(),
        true,
        'wierd reason'
      );
      setupForUpdateOneSuccess();
      await expect(jobRepo.updateWithErrorStatus('64ad959b423952aeb9341fad', 'wierd reason')).resolves.toEqual(true);
      expect(dbRepoHelper.collection.updateOne).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.updateOne).toBeCalledWith(testData.query, testData.update);

      expect(dbRepoHelper.logger.error).toBeCalledTimes(0);
    });
  });

  describe('getOneQueuedJobAndUpdate Tests', () => {
    test('getOneQueuedJobAndUpdate returns undefined as response is undefined', async () => {
      await expect(jobRepo.getOneQueuedJobAndUpdate()).rejects.toThrow(
        `Failed to update job ({\"status\":\"inQueue\",\"createdTime\":{\"$lte\":\"${new Date().toISOString()}\"}}) for {\"$set\":{\"startTime\":\"${new Date().toISOString()}\",\"status\":\"inProgress\"}}`
      );
    });

    test('getOneQueuedJobAndUpdate succeeds', async () => {
      const testData = TestDataProvider.getFindOneAndUpdateCallInfo();
      const mockVal = { value: getBuildJobPlain() };
      jest.spyOn(jobRepo, 'notify').mockResolvedValueOnce(true);
      dbRepoHelper.collection.findOneAndUpdate.mockResolvedValueOnce(mockVal);

      await expect(jobRepo.getOneQueuedJobAndUpdate()).resolves.toEqual(mockVal.value);
      expect(dbRepoHelper.collection.findOneAndUpdate).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.findOneAndUpdate).toBeCalledWith(
        testData.query,
        testData.update,
        testData.options
      );
      expect(dbRepoHelper.logger.error).toBeCalledTimes(0);
    });

    test('getOneQueuedJobAndUpdate timesout', async () => {
      dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
      dbRepoHelper.collection.findOneAndUpdate.mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5000, 'one');
        });
      });
      jobRepo.getOneQueuedJobAndUpdate().catch((error) => {
        expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
        expect(error.message).toContain(`Mongo Timeout Error: Timed out while retrieving job`);
      });
      jest.runAllTimers();
    });
  });

  describe('insertLogStatement Tests', () => {
    test('insertLogStatement succeeds', async () => {
      const testData = TestDataProvider.getInsertLogStatementInfo('64ad959b423952aeb9341fad', ['msg1', 'msg2']);
      setupForUpdateOneSuccess();
      await expect(jobRepo.insertLogStatement('64ad959b423952aeb9341fad', ['msg1', 'msg2'])).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  describe('insertNotificationMessages Tests', () => {
    test('insertNotificationMessages succeeds', async () => {
      const testData = TestDataProvider.getInsertComMessageInfo('64ad959b423952aeb9341fad', 'Successfully tested');
      setupForUpdateOneSuccess();
      await expect(
        jobRepo.insertNotificationMessages('64ad959b423952aeb9341fad', 'Successfully tested')
      ).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  describe('insertPurgedUrls Tests', () => {
    test('insertPurgedUrls succeeds', async () => {
      const testData = TestDataProvider.getInsertPurgedUrls('64ad959b423952aeb9341fad', ['url1', 'url2']);
      setupForUpdateOneSuccess();
      await expect(jobRepo.insertPurgedUrls('64ad959b423952aeb9341fad', ['url1', 'url2'])).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  // TODO: Fix failing test
  describe('resetJobStatus Tests', () => {
    test('resetJobStatus succeeds', async () => {
      const testData = TestDataProvider.getJobResetInfo(
        '64ad959b423952aeb9341fad',
        'reset job status for testing reasons '
      );
      setupForUpdateOneSuccess();
      await expect(
        jobRepo.resetJobStatus('64ad959b423952aeb9341fad', 'inQueue', 'reset job status for testing reasons ')
      ).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  describe('failStuckJobs Tests', () => {
    test('failStuckJobs succeeds', async () => {
      setupForFindSuccess();
      setupForUpdateManySuccess();
      await expect(jobRepo.failStuckJobs(8)).resolves.toEqual(undefined);
    });
  });

  function validateSuccessfulUpdate(testData: any) {
    expect(dbRepoHelper.collection.updateOne).toBeCalledTimes(1);
    expect(dbRepoHelper.collection.updateOne).toBeCalledWith(testData.query, testData.update);
    expect(dbRepoHelper.logger.error).toBeCalledTimes(0);
  }

  function setupForUpdateOneSuccess() {
    dbRepoHelper.collection.updateOne.mockReturnValueOnce({ modifiedCount: 1 });
    jest.spyOn(jobRepo, 'notify').mockResolvedValueOnce(true);
    dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
  }

  function setupForFindOneAndUpdateSuccess() {
    dbRepoHelper.collection.findOneAndUpdate.mockReturnValueOnce({ value: job });
    jest.spyOn(jobRepo, 'notify').mockResolvedValueOnce(true);
    dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
  }

  function setupForFindSuccess() {
    dbRepoHelper.collection.find.mockReturnValueOnce({
      toArray: () => [
        { _id: new ObjectId(), status: 'inProgress' },
        { _id: new ObjectId(), status: 'inQueue' },
        { _id: new ObjectId(), status: 'inProgress' },
      ],
    });
    dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
  }

  function setupForUpdateManySuccess() {
    dbRepoHelper.collection.updateMany.mockReturnValueOnce({ matchedCount: 2, modifiedCount: 2 });
    jest.spyOn(jobRepo, 'notify').mockResolvedValue(true);
    dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
  }
});
