import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';
import { DocsetsRepository } from '../../../src/repositories/docsetsRepository';

describe('Docsets Repository Tests', () => {
  let docsetsRepo: DocsetsRepository;
  let dbRepoHelper: DBRepositoryHelper;
  beforeEach(() => {
    dbRepoHelper = new DBRepositoryHelper();
    docsetsRepo = dbRepoHelper.init('docsets', 'docsets', 'docsets');
  });

  test('Construct Repo Entitlement Repository', () => {
    expect(new DocsetsRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
  });

  describe('Docsets Repository getRepoBranchesByRepoName Tests', () => {
    test('getRepoBranchesByRepoName returns failure as result is undefined', async () => {
      const testPipeline = TestDataProvider.getAggregationPipeline('repoName', 'test_repo');
      dbRepoHelper.collection.aggregate.mockReturnValueOnce({
        toArray: () => [],
      });
      await expect(docsetsRepo.getRepoBranchesByRepoName('test_repo', 'project')).resolves.toEqual({
        status: 'failure',
      });
      expect(dbRepoHelper.collection.aggregate).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.aggregate).toBeCalledWith(testPipeline, {});
    });

    test('getRepoBranchesByRepoName is successfull', async () => {
      const testPipeline = TestDataProvider.getAggregationPipeline('repoName', 'test_repo');
      dbRepoHelper.collection.aggregate.mockReturnValueOnce({
        toArray: () => ({
          bucket: {},
          url: {},
        }),
      });
      await docsetsRepo.getRepoBranchesByRepoName('test_repo', 'project');
      expect(dbRepoHelper.collection.aggregate).toBeCalledTimes(1);
      expect(dbRepoHelper.collection.aggregate).toBeCalledWith(testPipeline, {});
    });

    test('Update with completion status timesout', async () => {
      dbRepoHelper.config.get.calledWith('MONGO_TIMEOUT_S').mockReturnValueOnce(1);
      dbRepoHelper.collection.aggregate.mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5000, [[]]);
        });
      });
      docsetsRepo.getRepoBranchesByRepoName('test_repo', 'project').catch((error) => {
        expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
        expect(error.message).toContain(`Error while fetching repo by repo name test_repo`);
      });
      jest.runAllTimers();
    });
  });
});
