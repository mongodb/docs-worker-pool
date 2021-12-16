import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';

describe('Job Repository Tests', () => {
    let entitlementRepo: RepoEntitlementsRepository;
    let dbRepoHelper: DBRepositoryHelper;
    beforeEach(() => {
        dbRepoHelper = new DBRepositoryHelper();
        entitlementRepo = dbRepoHelper.init("repo", "entitlementCollection", "testColl");
    })

    test('Construct Repo Entitlement Repository', () => {
        expect(new RepoEntitlementsRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
    })

    describe('Repo Entitlements Repository getRepoEntitlementsByGithubUsername Tests', () => {
        test('getRepoEntitlementsByGithubUsername returns failure as result is undefined', async () => {
            const testData = TestDataProvider.getRepoEntitlementsByGithubUsernameInfo("test_user");
            await expect(entitlementRepo.getRepoEntitlementsByGithubUsername("test_user")).resolves.toEqual({ status: 'failure' });
            expect(dbRepoHelper.collection.findOne).toBeCalledTimes(1);
            expect(dbRepoHelper.collection.findOne).toBeCalledWith(testData.query);
        })

        test('getRepoEntitlementsByGithubUsername is successfull', async () => {
            const testData = TestDataProvider.getRepoEntitlementsByGithubUsernameInfo("test_user");
            dbRepoHelper.collection.findOne.mockReturnValueOnce({ github_username: "test_user", repos: ["great_repo", "greates_repo"] });
            await expect(entitlementRepo.getRepoEntitlementsByGithubUsername("test_user")).resolves.toEqual({ repos: ["great_repo", "greates_repo"], github_username: "test_user", status: "success" });
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
            entitlementRepo.getRepoEntitlementsByGithubUsername("test_user").catch((error) => {
                expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
                expect(error.message).toContain(`Mongo Timeout Error: Timedout while retrieving entitlements for test_user`)
            });
            jest.runAllTimers();

        })
    })
})