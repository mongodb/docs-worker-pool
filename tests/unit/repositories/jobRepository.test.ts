import { JobRepository } from '../../../src/repositories/jobRepository';
import { getBuildJobPlain } from '../../data/jobDef';
import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';

describe('Job Repository Tests', () => {
  let jobRepo: JobRepository;
  let dbRepoHelper: DBRepositoryHelper;
  beforeEach(() => {
    dbRepoHelper = new DBRepositoryHelper();
    jobRepo = dbRepoHelper.init('job', 'jobQueueCollection', 'testColl');
  });

  test('Construct Job Repository', () => {
    expect(new JobRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
  });

  describe('Job Repository updateWithCompletionStatus Tests', () => {
    test('Update with completion status throws DB Error as result is undefined', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        'Test_Job',
        'completed',
        'All good',
        new Date()
      );
      await expect(jobRepo.updateWithCompletionStatus('Test_Job', 'All good')).rejects.toThrow(
        `Failed to update job (${JSON.stringify(testData.query)}) for ${JSON.stringify(testData.update)}`
      );
    });

    test('Update with completion status throws DB Error as result length < 1', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        'Test_Job',
        'completed',
        'All good',
        new Date()
      );
      dbRepoHelper.collection.updateOne.mockReturnValue({ modifiedCount: -1 });
      await expect(jobRepo.updateWithCompletionStatus('Test_Job', 'All good')).rejects.toThrow(
        `Failed to update job (${JSON.stringify(testData.query)}) for ${JSON.stringify(testData.update)}`
      );
      expect(dbRepoHelper.collection.updateOne).toBeCalledTimes(1);
    });

    test('Update with completion status fails as there is no modifiedCount in results', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        'Test_Job',
        'completed',
        'All good',
        new Date()
      );
      dbRepoHelper.collection.updateOne.mockReturnValueOnce({ result: { sn: -1 } });
      await expect(jobRepo.updateWithCompletionStatus('Test_Job', 'All good')).rejects.toThrow(
        `Failed to update job (${JSON.stringify(testData.query)}) for ${JSON.stringify(testData.update)}`
      );
      expect(dbRepoHelper.collection.updateOne).toBeCalledTimes(1);
      expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
    });

    test('Update with completion status succeeds', async () => {
      setupForUpdateOneSuccess();
      await expect(jobRepo.updateWithCompletionStatus('Test_Job', 'All good')).resolves.toEqual(true);
      expect(dbRepoHelper.collection.updateOne).toBeCalledTimes(1);
      expect(dbRepoHelper.logger.error).toBeCalledTimes(0);
    });

    test('Update with completion status timesout', async () => {
      dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
      dbRepoHelper.collection.updateOne.mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5000, 'one');
        });
      });
      try {
        jobRepo.updateWithCompletionStatus('Test_Job', 'All good').catch((error) => {
          expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
          expect(error.message).toContain(
            `Mongo Timeout Error: Timed out while updating success status for jobId: Test_Job`
          );
        });
        jest.runAllTimers();
      } catch (err) {}
    });
  });

  describe('Job Repository updateWithFailureStatus Tests', () => {
    test('updateWithFailureStatus succeeds', async () => {
      const testData = TestDataProvider.getStatusUpdateQueryAndUpdateObject(
        'Test_Job',
        'failed',
        'All good',
        new Date(),
        true,
        'wierd reason'
      );
      setupForUpdateOneSuccess();
      await expect(jobRepo.updateWithErrorStatus('Test_Job', 'wierd reason')).resolves.toEqual(true);
      expect(dbRepoHelper.collection.updateOne).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.updateOne).toBeCalledWith(testData.query, testData.update);

      expect(dbRepoHelper.logger.error).toBeCalledTimes(0);
    });
  });

  describe('getOneQueuedJobAndUpdate Tests', () => {
    test('getOneQueuedJobAndUpdate returns undefined as response is undefined', async () => {
      await expect(jobRepo.getOneQueuedJobAndUpdate()).rejects.toThrow(
        'JobRepository:getOneQueuedJobAndUpdate retrieved Undefined job'
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
      const testData = TestDataProvider.getInsertLogStatementInfo('Test_Job', ['msg1', 'msg2']);
      setupForUpdateOneSuccess();
      await expect(jobRepo.insertLogStatement('Test_Job', ['msg1', 'msg2'])).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  describe('insertNotificationMessages Tests', () => {
    test('insertNotificationMessages succeeds', async () => {
      const testData = TestDataProvider.getInsertComMessageInfo('Test_Job', 'Successfully tested');
      setupForUpdateOneSuccess();
      await expect(jobRepo.insertNotificationMessages('Test_Job', 'Successfully tested')).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  describe('insertPurgedUrls Tests', () => {
    test('insertPurgedUrls succeeds', async () => {
      const testData = TestDataProvider.getInsertPurgedUrls('Test_Job', ['url1', 'url2']);
      setupForUpdateOneSuccess();
      await expect(jobRepo.insertPurgedUrls('Test_Job', ['url1', 'url2'])).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
    });
  });

  // TODO: Fix failing test
  describe('resetJobStatus Tests', () => {
    test('resetJobStatus succeeds', async () => {
      const testData = TestDataProvider.getJobResetInfo('Test_Job', 'reset job status for testing reasons ');
      setupForUpdateOneSuccess();
      await expect(
        jobRepo.resetJobStatus('Test_Job', 'inQueue', 'reset job status for testing reasons ')
      ).resolves.toEqual(true);
      validateSuccessfulUpdate(testData);
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
});
