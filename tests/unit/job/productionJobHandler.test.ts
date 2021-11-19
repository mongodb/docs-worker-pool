import { mockReset } from 'jest-mock-extended';
import { Buffer } from 'buffer'
import { TestDataProvider } from '../../data/data';
import { JobHandlerTestHelper } from '../../utils/jobHandlerTestHelper';

describe('ProductionJobHandler Tests', () => {
    
    let jobHandlerTestHelper: JobHandlerTestHelper;

  beforeEach(() => {
    jobHandlerTestHelper = new JobHandlerTestHelper();
    jobHandlerTestHelper.init("prod");
  })

  test('Construct Production Handler', () => {
    expect(jobHandlerTestHelper.jobHandler).toBeDefined();
  })

  test('Execute called after a stop signal throws error Production Handler at decorator', () => {
    jobHandlerTestHelper.jobHandler.stop();
    expect( () => {jobHandlerTestHelper.jobHandler.execute()}).toThrow(`${jobHandlerTestHelper.job._id} is stopped`);
  })

  test('Execute throws error when cleaning up should update status', async () => {
    jobHandlerTestHelper.fileSystemServices.removeDirectory.calledWith(`repos/${jobHandlerTestHelper.job.payload.repoName}`).mockImplementation(() => { throw new Error("Invalid Directory");});
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.fileSystemServices.removeDirectory).toBeCalledWith(`repos/${jobHandlerTestHelper.job.payload.repoName}`);
    expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Invalid Directory");
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})


test('Execute throws error when cloning repo should update status and save the logs', async () => {
    jobHandlerTestHelper.repoConnector.cloneRepo.mockImplementation((targetPath:string) => { throw new Error("Invalid RepoName");});
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.fileSystemServices.removeDirectory).toBeCalledWith(`repos/${jobHandlerTestHelper.job.payload.repoName}`);
    expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Invalid RepoName");
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.logger.save).toBeCalledTimes(3);
})


describe.each(TestDataProvider.getAllCommitCheckCases())('Validate all commit check error cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockReturnValue(element);
        await jobHandlerTestHelper.jobHandler.execute();
        expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(jobHandlerTestHelper.repoConnector.checkCommits).toBeCalledTimes(1);
        expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, `Specified commit does not exist on ${jobHandlerTestHelper.job.payload.branchName} branch`);
    })
})

test(`commit check throws , status updated properly`, async () => {
    jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockImplementation(() => { throw new Error("Commit check issue");})
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.repoConnector.checkCommits).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Commit check issue");
})

test('Execute throws error when Pulling repo should update status and save the logs', async () => {
    jobHandlerTestHelper.repoConnector.pullRepo.calledWith(jobHandlerTestHelper.job).mockImplementation(() => { throw new Error("Invalid RepoName during pull repo");});
    jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobHandlerTestHelper.job));
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Invalid RepoName during pull repo");
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Applying patch repo should update status and save the logs', async () => {
    jobHandlerTestHelper.repoConnector.applyPatch.calledWith(jobHandlerTestHelper.job).mockImplementation(() => { throw new Error("Error while applying patch RepoName during pull repo");});
    jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobHandlerTestHelper.job));
    jobHandlerTestHelper.job.payload.patch = "Testing apply patch";
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Error while applying patch RepoName during pull repo");
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Downloading makefile repo should update status', async () => {
    jobHandlerTestHelper.fileSystemServices.saveUrlAsFile.calledWith(`https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${jobHandlerTestHelper.job.payload.repoName}`).mockImplementation(() => { throw new Error("Error while Downloading makefile");});
    jobHandlerTestHelper.repoConnector.checkCommits.calledWith(jobHandlerTestHelper.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(jobHandlerTestHelper.job));
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Error while Downloading makefile");
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

describe.each(TestDataProvider.getPathPrefixCases())('Validate all Generate path prefix cases', (element) => {
    test(`Testing Path prefix with input ${JSON.stringify(element)}`, async () => {
        jobHandlerTestHelper.job.payload.publishedBranches = element.value;
        jobHandlerTestHelper.setupForSuccess();
        await jobHandlerTestHelper.jobHandler.execute();
        expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
        expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
        if (element.error) {
            expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Cannot read property 'active' of null");
            expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
        } else {
            expect(jobHandlerTestHelper.job.payload.pathPrefix).toEqual(element.pathPrefix);
            expect(jobHandlerTestHelper.job.payload.mutPrefix).toEqual(element.mutPrefix);
        } 
    })
})

describe.each(TestDataProvider.getManifestPrefixCases())('Validate all Generate manifest prefix cases', (element) => {
    test(`Testing manifest prefix with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        jobHandlerTestHelper.executeCommandWithGivenParamsForManifest(element);
        await jobHandlerTestHelper.jobHandler.execute();
        expect(jobHandlerTestHelper.repoConnector.pullRepo).toBeCalledTimes(1);
        expect(jobHandlerTestHelper.repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(jobHandlerTestHelper.job.payload.manifestPrefix).toEqual(element.manifestPrefix);
    })
})

test('Execute Next Gen Manifest prefix generation throws error as get snooty name throws', async () => {
    jobHandlerTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobHandlerTestHelper.job);
    jobHandlerTestHelper.setupForSuccess();
    mockReset(jobHandlerTestHelper.jobCommandExecutor);
    jobHandlerTestHelper.jobCommandExecutor.getSnootyProjectName.calledWith(jobHandlerTestHelper.job.payload.repoName).mockImplementation(() => { throw new Error("Cant get the project name");});
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Cant get the project name");
})

describe.each(TestDataProvider.getEnvVarsTestCases())('Validate all set env var cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        jobHandlerTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobHandlerTestHelper.job);
        jobHandlerTestHelper.job.payload.aliased = true;
        jobHandlerTestHelper.job.payload.primaryAlias = null;
        jobHandlerTestHelper.setupForSuccess();
        jobHandlerTestHelper.config.get.calledWith('GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION').mockReturnValue(element['GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION']);
        jobHandlerTestHelper.config.get.calledWith('GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN').mockReturnValue(element['GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN']);
        await jobHandlerTestHelper.jobHandler.execute();
        jobHandlerTestHelper.verifyNextGenSuccess();
        expect(jobHandlerTestHelper.fileSystemServices.writeToFile).toBeCalledWith(`repos/${jobHandlerTestHelper.job.payload.repoName}/.env.production`, 
                                                              TestDataProvider.getEnvVarsWithPathPrefixWithFlags(jobHandlerTestHelper.job, element['navString'], element['versionString']), 
                                                              {"encoding": "utf8", "flag": "w"})
    })
})

test('Execute Next Gen Build throws error while executing commands', async () => {
    jobHandlerTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobHandlerTestHelper.job);
    jobHandlerTestHelper.setupForSuccess();
    mockReset(jobHandlerTestHelper.jobCommandExecutor);
    jobHandlerTestHelper.jobCommandExecutor.getSnootyProjectName.calledWith(jobHandlerTestHelper.job.payload.repoName).mockReturnValue({output:jobHandlerTestHelper.job.payload.repoName})
    jobHandlerTestHelper.jobCommandExecutor.execute.mockReturnValue({status:"failed", error:"Command Execution failed"});
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Command Execution failed");
})

test('Execute Next Gen Build throws error when execute throws error', async () => {
    jobHandlerTestHelper.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(jobHandlerTestHelper.job);
    jobHandlerTestHelper.setupForSuccess();
    jobHandlerTestHelper.jobCommandExecutor.execute.mockImplementation(() => { throw new Error("Unable to Execute Commands");});
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Unable to Execute Commands");
})

describe.each(TestDataProvider.getManifestPrefixCases())('Execute Next Gen Build Validate all deploy commands', (element) => {
    test(`Testing  all deploy command cases with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        jobHandlerTestHelper.executeCommandWithGivenParamsForManifest(element);
        jobHandlerTestHelper.jobCommandExecutor.execute.mockReturnValue({status:"success", output: "Great work", error:null})
        jobHandlerTestHelper.fileSystemServices.getFilesInDirectory.calledWith(`./${jobHandlerTestHelper.job.payload.repoName}/build/public`, '').mockReturnValue(["1.html", "2.html", "3.html"]);
        await jobHandlerTestHelper.jobHandler.execute();
        jobHandlerTestHelper.verifyNextGenSuccess();
        const expectedCommandSet = TestDataProvider.getExpectedProdDeployNextGenCommands(jobHandlerTestHelper.job);
        expect(jobHandlerTestHelper.job.deployCommands).toEqual(expectedCommandSet);
        expect(jobHandlerTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(jobHandlerTestHelper.job._id,  "Great work");
        expect(jobHandlerTestHelper.fileSystemServices.getFilesInDirectory).toBeCalledWith(`./${jobHandlerTestHelper.job.payload.repoName}/build/public`, '',null, null);
        expect(jobHandlerTestHelper.jobRepo.updateWithCompletionStatus).toBeCalledWith(jobHandlerTestHelper.job._id, ["1.html", "2.html", "3.html"]);
    })
})

test('Execute Build succeeded deploy failed updates status properly with out and err', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(Buffer.from("Bad work"), Buffer.from("Not Good"));
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(jobHandlerTestHelper.jobRepo.insertNotificationMessages).toBeCalledWith(jobHandlerTestHelper.job._id,  "Bad work");
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Not Good");
})

test('Execute Build succeeded deploy failed updates status properly on nullish case', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(null, Buffer.from("Not Good"));
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id,  "Not Good");
})

test('Execute Build succeeded deploy failed with an ERROR updates status properly', async () => {
    jobHandlerTestHelper.setStageForDeployFailure(null, Buffer.from("ERROR:BAD ONE"));
    await jobHandlerTestHelper.jobHandler.execute();
    jobHandlerTestHelper.verifyNextGenSuccess();
    expect(jobHandlerTestHelper.jobRepo.updateWithErrorStatus).toBeCalledWith(jobHandlerTestHelper.job._id, "Failed pushing to Production: ERROR:BAD ONE");
})

test('Execute legacy build successfully purges only updated urls', async () => {
    const purgedUrls = jobHandlerTestHelper.setStageForDeploySuccess(false);
    jobHandlerTestHelper.config.get.calledWith("shouldPurgeAll").mockReturnValue(false);
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(TestDataProvider.getCommonBuildCommands(jobHandlerTestHelper.job));
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(TestDataProvider.getCommonDeployCommands(jobHandlerTestHelper.job));
    expect(jobHandlerTestHelper.cdnConnector.purge).toBeCalledWith(jobHandlerTestHelper.job._id, purgedUrls);
    expect(jobHandlerTestHelper.jobRepo.insertPurgedUrls).toBeCalledWith(jobHandlerTestHelper.job._id, purgedUrls);
    expect(jobHandlerTestHelper.cdnConnector.purgeAll).toHaveBeenCalledTimes(0);
})

test('Execute legacy build runs successfully purges all for main service', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(false);
    jobHandlerTestHelper.config.get.calledWith("shouldPurgeAll").mockReturnValue(true);
    jobHandlerTestHelper.config.get.calledWith("cdn_creds").mockReturnValue({main:{ "id": "sid",
    "key": "token"}});
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.job.payload.isNextGen).toEqual(false);
    expect(jobHandlerTestHelper.job.buildCommands).toEqual(TestDataProvider.getCommonBuildCommands(jobHandlerTestHelper.job));
    expect(jobHandlerTestHelper.job.deployCommands).toEqual(TestDataProvider.getCommonDeployCommands(jobHandlerTestHelper.job));
    expect(jobHandlerTestHelper.cdnConnector.purgeAll).toBeCalledTimes(1);
    expect(jobHandlerTestHelper.cdnConnector.purge).toHaveBeenCalledTimes(0);
    expect(jobHandlerTestHelper.jobRepo.insertPurgedUrls).toHaveBeenCalledTimes(0);
})

test('Execute build runs successfully purges all for atlas service', async () => {
    jobHandlerTestHelper.setStageForDeploySuccess(false);
    jobHandlerTestHelper.config.get.calledWith("shouldPurgeAll").mockReturnValue(true);
    jobHandlerTestHelper.config.get.calledWith("cdn_creds").mockReturnValue({"cloud-docs-osb":{ "id": "sid",
    "key": "token"}});
    jobHandlerTestHelper.job.payload.repoName = "cloud-docs-osb";
    await jobHandlerTestHelper.jobHandler.execute();
    expect(jobHandlerTestHelper.cdnConnector.purgeAll).toBeCalledTimes(1);
})

})

