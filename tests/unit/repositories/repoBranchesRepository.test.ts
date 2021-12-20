import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';

describe('Repo Branches Repository Tests', () => {
    let repoBranchesRepo: RepoBranchesRepository;
    let dbRepoHelper: DBRepositoryHelper;
    beforeEach(() => {
        dbRepoHelper = new DBRepositoryHelper();
        repoBranchesRepo = dbRepoHelper.init("repoBranches", "repoBranchesCollection", "testColl");
    })

    test('Construct Repo Entitlement Repository', () => {
        expect(new RepoBranchesRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
    })

    describe('Repo Branches Repository getRepoBranchesByRepoName Tests', () => {
        test('getRepoBranchesByRepoName returns failure as result is undefined', async () => {
            const testData = TestDataProvider.getRepoBranchesByRepoName("test_repo");
            await expect(repoBranchesRepo.getRepoBranchesByRepoName("test_repo")).resolves.toEqual({ status: 'failure' });
            expect(dbRepoHelper.collection.findOne).toBeCalledTimes(1);
            expect(dbRepoHelper.collection.findOne).toBeCalledWith(testData.query);
        })

        test('getRepoBranchesByRepoName is successfull', async () => {
            const testData = TestDataProvider.getRepoBranchesByRepoName("test_repo");
            dbRepoHelper.collection.findOne.mockReturnValueOnce(TestDataProvider.getRepoBranchesData('test_repo'));
            await repoBranchesRepo.getRepoBranchesByRepoName("test_repo");
            expect(dbRepoHelper.collection.findOne).toBeCalledTimes(1);
            expect(dbRepoHelper.collection.findOne).toBeCalledWith(testData.query);
        })

        test('Update with completion status timesout', async () => {
            dbRepoHelper.config.get.calledWith("MONGO_TIMEOUT_S").mockReturnValueOnce(1);
            dbRepoHelper.collection.findOne.mockImplementationOnce(() => {
                return new Promise((resolve, reject) => {
                    setTimeout(resolve, 5000, 'one');
                });
            });
            repoBranchesRepo.getRepoBranchesByRepoName("test_repo").catch((error) => {
                expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
                expect(error.message).toContain(`Mongo Timeout Error: Timedout while retrieving Repoinformation for test_repo`)
            });
            jest.runAllTimers();

        })
    })
})