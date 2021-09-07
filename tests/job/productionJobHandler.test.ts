import { mockReset } from 'jest-mock-extended';
import { TestDataProvider } from '../data/data';
import { JobValidatorTestHelper } from '../utils/jobValidaterTestHelper';


describe('JobHandlerFactory Tests', () => {
    
    let jobValidatorTestHelper: JobValidatorTestHelper;

  beforeEach(() => {
    jobValidatorTestHelper = new JobValidatorTestHelper();
    jobValidatorTestHelper.init("prod");
  })

  test('Construct Production Handler', () => {
    expect(jobValidatorTestHelper.jobHandler).toBeDefined();
  })

  test('Execute called after a stop signal throws error Production Handler at decorator', () => {
    jobValidatorTestHelper.jobHandler.stop();
    expect( () => {jobValidatorTestHelper.jobHandler.execute()}).toThrow(`${jobValidatorTestHelper.job._id} is stopped`);
  })

  test('Execute throws error when cleaning up should update status', async () => {
    jobValidatorTestHelper.fileSystemServices.removeDirectory.calledWith(`repos/${jobValidatorTestHelper.job.payload.repoName}`).mockImplementation(() => { throw new Error("Invalid Directory");});
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.fileSystemServices.removeDirectory).toBeCalledWith(`repos/${jobValidatorTestHelper.job.payload.repoName}`);
    expect(jobValidatorTestHelper.repoConnector.cloneRepo).toBeCalledTimes(0);
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Invalid Directory");
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})


test('Execute throws error when cloning repo should update status and save the logs', async () => {
    jobValidatorTestHelper.repoConnector.cloneRepo.mockImplementation(() => { throw new Error("Invalid RepoName");});
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.fileSystemServices.removeDirectory).toBeCalledWith(`repos/${jobValidatorTestHelper.job.payload.repoName}`);
    expect(jobValidatorTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Invalid RepoName");
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.logger.save).toBeCalledTimes(3);
})


describe.each(TestDataProvider.getAllCommitCheckCases())('Validate all commit check error cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        jobValidatorTestHelper.repoConnector.checkCommits.calledWith(jobValidatorTestHelper.job).mockReturnValue(element);
        await jobValidatorTestHelper.jobHandler.execute();
        expect(jobValidatorTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(jobValidatorTestHelper.repoConnector.checkCommits).toBeCalledTimes(1);
        expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, `Specified commit does not exist on ${jobValidatorTestHelper.job.payload.branchName} branch`);
    })
})

test(`commit check throws , status updated properly`, async () => {
    jobValidatorTestHelper.repoConnector.checkCommits.calledWith(jobValidatorTestHelper.job).mockImplementation(() => { throw new Error("Commit check issue");})
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.repoConnector.checkCommits).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Commit check issue");
})

test('Execute throws error when Pulling repo should update status and save the logs', async () => {
    jobValidatorTestHelper.repoConnector.pullRepo.calledWith(jobValidatorTestHelper.job).mockImplementation(() => { throw new Error("Invalid RepoName during pull repo");});
    jobValidatorTestHelper.repoConnector.checkCommits.calledWith(jobValidatorTestHelper.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobValidatorTestHelper.job));
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Invalid RepoName during pull repo");
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Applying patch repo should update status and save the logs', async () => {
    jobValidatorTestHelper.repoConnector.applyPatch.calledWith(jobValidatorTestHelper.job).mockImplementation(() => { throw new Error("Error while applying patch RepoName during pull repo");});
    jobValidatorTestHelper.repoConnector.checkCommits.calledWith(jobValidatorTestHelper.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobValidatorTestHelper.job));
    jobValidatorTestHelper.job.payload.patch = "Testing apply patch";
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Error while applying patch RepoName during pull repo");
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Downloading makefile repo should update status', async () => {
    jobValidatorTestHelper.fileSystemServices.saveUrlAsFile.calledWith(`https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${jobValidatorTestHelper.job.payload.repoName}`).mockImplementation(() => { throw new Error("Error while Downloading makefile");});
    jobValidatorTestHelper.repoConnector.checkCommits.calledWith(jobValidatorTestHelper.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobValidatorTestHelper.job));
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Error while Downloading makefile");
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

describe.each(TestDataProvider.getPathPrefixCases())('Validate all Generate path prefix cases', (element) => {
    test(`Testing Path prefix with input ${JSON.stringify(element)}`, async () => {
        jobValidatorTestHelper.job.payload.publishedBranches = element.value;
        jobValidatorTestHelper.setupForSuccess();
        await jobValidatorTestHelper.jobHandler.execute();
        expect(jobValidatorTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
        expect(jobValidatorTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
        if (element.error) {
            expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Cannot read property 'active' of null");
            expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
        } else {
            expect(jobValidatorTestHelper.job.payload.pathPrefix).toEqual(element.pathPrefix);
            expect(jobValidatorTestHelper.job.payload.mutPrefix).toEqual(element.mutPrefix);
        } 
    })
})

describe.each(TestDataProvider.getManifestPrefixCases())('Validate all Generate manifest prefix cases', (element) => {
    test(`Testing manifest prefix with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        jobValidatorTestHelper.executeCommandWithGivenParamsForManifest(element);
        await jobValidatorTestHelper.jobHandler.execute();
        expect(jobValidatorTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
        expect(jobValidatorTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(jobValidatorTestHelper.job.payload.manifestPrefix).toEqual(element.manifestPrefix);
    })
})

test('Execute Next Gen Manifest prefix generation throws error as get snooty name throws', async () => {
    jobValidatorTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobValidatorTestHelper.job);
    jobValidatorTestHelper.setupForSuccess();
    mockReset(jobValidatorTestHelper.jobCommandExecutor);
    jobValidatorTestHelper.jobCommandExecutor.getSnootyProjectName.calledWith(jobValidatorTestHelper.job.payload.repoName).mockImplementation(() => { throw new Error("Cant get the project name");});
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Cant get the project name");
})

describe.each(TestDataProvider.getEnvVarsTestCases())('Validate all set env var cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        jobValidatorTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobValidatorTestHelper.job);
        jobValidatorTestHelper.job.payload.aliased = true;
        jobValidatorTestHelper.job.payload.primaryAlias = null;
        jobValidatorTestHelper.setupForSuccess();
        jobValidatorTestHelper.config.get.calledWith('GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION').mockReturnValue(element['GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION']);
        jobValidatorTestHelper.config.get.calledWith('GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN').mockReturnValue(element['GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN']);
        await jobValidatorTestHelper.jobHandler.execute();
        jobValidatorTestHelper.verifyNextGenSuccess();
        expect(jobValidatorTestHelper.fileSystemServices.writeToFile).toBeCalledWith(`repos/${jobValidatorTestHelper.job.payload.repoName}/.env.production`, 
                                                              TestDataProvider.getEnvVarsWithPathPrefixWithFlags(jobValidatorTestHelper.job, element['navString'], element['versionString']), 
                                                              {"encoding": "utf8", "flag": "w"})
    })
})

test('Execute Next Gen Build throws error while executing commands', async () => {
    jobValidatorTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobValidatorTestHelper.job);
    jobValidatorTestHelper.setupForSuccess();
    mockReset(jobValidatorTestHelper.jobCommandExecutor);
    jobValidatorTestHelper.jobCommandExecutor.execute.mockReturnValue({status:"failed", error:"Command Execution failed"});
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Command Execution failed");
})

test('Execute Next Gen Build throws error when execute throws error', async () => {
    jobValidatorTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobValidatorTestHelper.job);
    jobValidatorTestHelper.setupForSuccess();
    jobValidatorTestHelper.jobCommandExecutor.execute.mockImplementation(() => { throw new Error("Unable to Execute Commands");});
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Unable to Execute Commands");
})

test('Execute Next Gen Build throws error when build commands are empty', async () => {
    jobValidatorTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobValidatorTestHelper.job);
    jobValidatorTestHelper.setupForSuccess();
    jobValidatorTestHelper.mockArrayLength(0, jobValidatorTestHelper.job, true, false);
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "No commands to execute");
    jobValidatorTestHelper.unMockArrayLength();
})

test('Execute Next Gen Build throws error when deploy commands are empty', async () => {
    jobValidatorTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobValidatorTestHelper.job);
    jobValidatorTestHelper.setupForSuccess();
    jobValidatorTestHelper.mockArrayLength(0, jobValidatorTestHelper.job, false, true);
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Failed pushing to Production, No commands to execute");
    jobValidatorTestHelper.unMockArrayLength();
})

describe.each(TestDataProvider.getManifestPrefixCases())('Execute Next Gen Build Validate all deploy commands', (element) => {
    test(`Testing  all deploy command cases with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        jobValidatorTestHelper.executeCommandWithGivenParamsForManifest(element);
        jobValidatorTestHelper.jobCommandExecutor.execute.mockReturnValue({status:"success", output: "Great work", error:null})
        jobValidatorTestHelper.fileSystemServices.getFilesInDirectory.calledWith(`./${jobValidatorTestHelper.job.payload.repoName}/build/public`, '').mockReturnValue(["1.html", "2.html", "3.html"]);
        await jobValidatorTestHelper.jobHandler.execute();
        jobValidatorTestHelper.verifyNextGenSuccess();
        const expectedCommandSet = TestDataProvider.getExpectedProdDeployNextGenCommands(jobValidatorTestHelper.job);
        expect(jobValidatorTestHelper.job.deployCommands).toEqual(expectedCommandSet);
        expect(jobValidatorTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(jobValidatorTestHelper.job._id,  "Great work");
        expect(jobValidatorTestHelper.fileSystemServices.getFilesInDirectory).toBeCalledWith(`./${jobValidatorTestHelper.job.payload.repoName}/build/public`, '');
        expect(jobValidatorTestHelper.jobRepo.updateWithCompletionStatus).toBeCalledWith(jobValidatorTestHelper.job._id, ["1.html", "2.html", "3.html"]);
    })
})

test('Execute Build succeeded deploy failed updates status properly', async () => {
    jobValidatorTestHelper.setStageForDeployFailure("Bad work", "Not Good");
    await jobValidatorTestHelper.jobHandler.execute();
    jobValidatorTestHelper.verifyNextGenSuccess();
    expect(jobValidatorTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(jobValidatorTestHelper.job._id,  "Bad work");
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Not Good");
})

test('Execute Build succeeded deploy failed updates status properly', async () => {
    jobValidatorTestHelper.setStageForDeployFailure(null, "Not Good");
    await jobValidatorTestHelper.jobHandler.execute();
    jobValidatorTestHelper.verifyNextGenSuccess();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id,  "Cannot read property 'replace' of null");
})

test('Execute Build succeeded deploy failed with an ERROR updates status properly', async () => {
    jobValidatorTestHelper.setStageForDeployFailure(null, "ERROR:BAD ONE");
    await jobValidatorTestHelper.jobHandler.execute();
    jobValidatorTestHelper.verifyNextGenSuccess();
    expect(jobValidatorTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobValidatorTestHelper.job._id, "Failed pushing to Production: ERROR:BAD ONE");
})

test('Execute legacy build successfully purges only updated urls', async () => {
    const purgedUrls = jobValidatorTestHelper.setStageForDeploySuccess(false);
    jobValidatorTestHelper.config.get.calledWith("shouldPurgeAll").mockReturnValue(false);
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobValidatorTestHelper.job.buildCommands).toEqual(TestDataProvider.getCommonBuildCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.job.deployCommands).toEqual(TestDataProvider.getCommonDeployCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.cdnConnector.purge).toBeCalledWith(jobValidatorTestHelper.job._id, purgedUrls);
    expect(jobValidatorTestHelper.jobRepo.insertPurgedUrls).toBeCalledWith(jobValidatorTestHelper.job._id, purgedUrls);
    expect(jobValidatorTestHelper.cdnConnector.purgeAll).toHaveBeenCalledTimes(0);
})

test('Execute legacy build runs successfully purges all', async () => {
    jobValidatorTestHelper.setStageForDeploySuccess(false);
    jobValidatorTestHelper.config.get.calledWith("shouldPurgeAll").mockReturnValue(true);
    await jobValidatorTestHelper.jobHandler.execute();
    expect(jobValidatorTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobValidatorTestHelper.job.buildCommands).toEqual(TestDataProvider.getCommonBuildCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.job.deployCommands).toEqual(TestDataProvider.getCommonDeployCommands(jobValidatorTestHelper.job));
    expect(jobValidatorTestHelper.cdnConnector.purgeAll).toBeCalledWith(jobValidatorTestHelper.job._id);
    expect(jobValidatorTestHelper.cdnConnector.purge).toHaveBeenCalledTimes(0);
    expect(jobValidatorTestHelper.jobRepo.insertPurgedUrls).toHaveBeenCalledTimes(0);
})

})

