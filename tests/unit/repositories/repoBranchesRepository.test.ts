import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { DBRepositoryHelper } from '../../utils/repositoryHelper';
import { TestDataProvider } from '../../data/data';

import { JestMockExtended } from 'jest-mock-extended';
describe('Job Repository Tests', () => {
    let branchesRepo: RepoBranchesRepository;
    let dbRepoHelper: DBRepositoryHelper;
    beforeEach(() => {
        dbRepoHelper = new DBRepositoryHelper();
        branchesRepo = dbRepoHelper.init("branchesRepo", "reposBranchesCollection", "testColl"); 
    })

    test('Construct Repo Entitlement Repository', () => {
        expect(new RepoBranchesRepository(dbRepoHelper.db, dbRepoHelper.config, dbRepoHelper.logger)).toBeDefined();
    })

    describe('Repo Branches Repository getConfiguredBranchesByGithubRepoName Tests', () => {
      
      test('getConfiguredBranchesByGithubRepoName returns failure as result is undefined', async () => {
            const testData = TestDataProvider.getConfiguredBranchesByGithubRepoNameInfo("fake_repo");
            await expect(branchesRepo.getConfiguredBranchesByGithubRepoName("fake_repo")).resolves.toEqual({ status: 'failure' });
            expect(dbRepoHelper.collection.findOne).toBeCalledTimes(1);
            expect(dbRepoHelper.collection.findOne).toBeCalledWith(testData.query);
        })

        test('getConfiguredBranchesByGithubRepoName is successful', async () => {
            const testData = TestDataProvider.getConfiguredBranchesByGithubRepoNameInfo("docs-test-repo");
            dbRepoHelper.collection.findOne.mockReturnValueOnce({ repoName: "docs-test-repo", 
                                                                  branches: [ { gitBranchName: "branchName", urlSlug: "current", aliases: ["current"]}, 
                                                                              { gitBranchname: "anotherBranch"}]});
            await expect(branchesRepo.getConfiguredBranchesByGithubRepoName("docs-test-repo")).resolves.toEqual({ 
                      repoName: "docs-test-repo", 
                      branches: [ { gitBranchName: "branchName", urlSlug: "current", aliases: ["current"]}, 
                        {           gitBranchname: "anotherBranch"}],
                      status: 'success'});
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
            branchesRepo.getConfiguredBranchesByGithubRepoName("docs-test-repo").catch((error) => {
                expect(dbRepoHelper.logger.error).toBeCalledTimes(1);
                expect(error.message).toContain(`Mongo Timeout Error: Timedout while retrieving repos entry for docs-test-repo`)
            });
            jest.runAllTimers();

        })
    })
})