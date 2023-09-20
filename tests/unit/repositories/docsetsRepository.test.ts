import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';
import { getBuildJobDef } from '../../data/jobDef';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';

describe('Docsets Repository Tests', () => {
  let docsetsRepo: DocsetsRepository;
  let dbRepoHelper: DBRepositoryHelper;
  beforeEach(() => {
    dbRepoHelper = new DBRepositoryHelper();
    docsetsRepo = dbRepoHelper.init('docsets', 'docsetsCollection', 'testColl');
  });

  test('Construct Repo Entitlement Repository', () => {
    expect(new DocsetsRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
  });

  describe('Docsets Repository getRepoBranchesByRepoName Tests', () => {
    test('getRepoBranchesByRepoName returns failure as result is undefined', async () => {
      const testPipeline = TestDataProvider.getAggregationPipeline('repoName', 'test_repo');
      await expect(docsetsRepo.getRepoBranchesByRepoName('test_repo')).resolves.toEqual({ status: 'failure' });
      expect(dbRepoHelper.collection.aggregate).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.aggregate).toBeCalledWith(testPipeline, {});
    });

    test('getRepoBranchesByRepoName is successfull', async () => {
      const job = getBuildJobDef();
      const testData = TestDataProvider.getRepoBranchesByRepoName('test_repo');
      job.payload.repoName = 'test_repo';
      dbRepoHelper.collection.aggregate.mockReturnValueOnce(TestDataProvider.getRepoBranchesData(job));
      await docsetsRepo.getRepoBranchesByRepoName('test_repo');
      expect(dbRepoHelper.collection.aggregate).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.aggregate).toBeCalledWith(testData.query, {});
    });

    test('Update with completion status timesout', async () => {
      dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
      dbRepoHelper.collection.aggregate.mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5000, []);
        });
      });
      console.log('dbRepoHelper ', dbRepoHelper);
      console.log('docsetREPO ', docsetsRepo);
      // docsetsRepo.getRepoBranchesByRepoName('test_repo').catch((error) => {
      //   expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
      //   expect(error.message).toContain(
      //     `Mongo Timeout Error: Timedout while retrieving repo information for test_repo`
      //   );
      // });
      // jest.runAllTimers();
    });
  });
});
