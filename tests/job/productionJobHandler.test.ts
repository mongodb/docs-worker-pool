import { mockDeep, mockReset } from 'jest-mock-extended';
import { IJob } from '../../entities/job';
import { IConfig } from 'config';
import { JobRepository } from '../../repositories/jobRepository';
import { IFileSystemServices } from '../../services/fileServices';
import { IJobCommandExecutor } from '../../services/commandExecutor';
import { ICDNConnector } from '../../services/cdn';
import { IRepoConnector } from '../../services/repo';
import { IJobRepoLogger } from '../../services/logger';
import { ProductionJobHandler } from '../../job/productionJobHandler';
import * as data from '../data/jobDef';
import { TestDataProvider } from '../data/data';
import  TestableArrayWrapper from '../../job/ITestableTypeWrapper';
import { join } from 'node:path';
import { futimes } from 'fs-extra';


describe('JobHandlerFactory Tests', () => {
  let job: IJob;
  let config: IConfig;
  let jobRepo: JobRepository;
  let fileSystemServices: IFileSystemServices;
  let jobCommandExecutor: IJobCommandExecutor;
  let cdnConnector: ICDNConnector;
  let repoConnector: IRepoConnector;
  let logger: IJobRepoLogger;
  let prodJobHandler: ProductionJobHandler;
  let lengthPrototype;

  beforeEach(() => {
    job = JSON.parse(JSON.stringify(data.default));
    config = mockDeep<IConfig>();
    jobRepo = mockDeep<JobRepository>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    cdnConnector = mockDeep<ICDNConnector>();
    repoConnector = mockDeep<IRepoConnector>();
    logger = mockDeep<IJobRepoLogger>();
    prodJobHandler = new ProductionJobHandler(job,config,jobRepo,fileSystemServices,jobCommandExecutor, cdnConnector, repoConnector, logger);
    lengthPrototype = TestableArrayWrapper.prototype.length;
  })

  test('Construct Production Handler', () => {
    expect(new ProductionJobHandler(job,config,jobRepo,fileSystemServices,jobCommandExecutor, cdnConnector, repoConnector, logger)).toBeDefined();
  })

  test('Execute called after a stop signal throws error Production Handler at decorator', () => {
    prodJobHandler.stop();
    expect( () => {prodJobHandler.execute()}).toThrow(`${job._id} is stopped`);
  })

  test('Execute throws error when cleaning up should update status', async () => {
    fileSystemServices.removeDirectory.calledWith(`repos/${job.payload.repoName}`).mockImplementation(() => { throw new Error("Invalid Directory");});
    await prodJobHandler.execute();
    expect(fileSystemServices.removeDirectory).toBeCalledWith(`repos/${job.payload.repoName}`);
    expect(repoConnector.cloneRepo).toBeCalledTimes(0);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Invalid Directory");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})


test('Execute throws error when cloning repo should update status and save the logs', async () => {
    repoConnector.cloneRepo.mockImplementation(() => { throw new Error("Invalid RepoName");});
    await prodJobHandler.execute();
    expect(fileSystemServices.removeDirectory).toBeCalledWith(`repos/${job.payload.repoName}`);
    expect(repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Invalid RepoName");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
    expect(logger.save).toBeCalledTimes(3);
})


describe.each(TestDataProvider.getAllCommitCheckCases())('Validate all commit check error cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        repoConnector.checkCommits.calledWith(job).mockReturnValue(element);
        await prodJobHandler.execute();
        expect(repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(repoConnector.checkCommits).toBeCalledTimes(1);
        expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, `Specified commit does not exist on ${job.payload.branchName} branch`);
    })
})

test(`commit check throws , status updated properly`, async () => {
    repoConnector.checkCommits.calledWith(job).mockImplementation(() => { throw new Error("Commit check issue");})
    await prodJobHandler.execute();
    expect(repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(repoConnector.checkCommits).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Commit check issue");
})

test('Execute throws error when Pulling repo should update status and save the logs', async () => {
    repoConnector.pullRepo.calledWith(job).mockImplementation(() => { throw new Error("Invalid RepoName during pull repo");});
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Invalid RepoName during pull repo");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Applying patch repo should update status and save the logs', async () => {
    repoConnector.applyPatch.calledWith(job).mockImplementation(() => { throw new Error("Error while applying patch RepoName during pull repo");});
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    job.payload.patch = "Testing apply patch";
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Error while applying patch RepoName during pull repo");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

test('Execute throws error when Downloading makefile repo should update status', async () => {
    fileSystemServices.saveUrlAsFile.calledWith(`https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${job.payload.repoName}`).mockImplementation(() => { throw new Error("Error while Downloading makefile");});
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    await prodJobHandler.execute();
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Error while Downloading makefile");
    expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
})

describe.each(TestDataProvider.getPathPrefixCases())('Validate all Generate path prefix cases', (element) => {
    test(`Testing Path prefix with input ${JSON.stringify(element)}`, async () => {
        job.payload.publishedBranches = element.value;
        setupForSuccess();
        await prodJobHandler.execute();
        expect(repoConnector.pullRepo).toBeCalledTimes(1);
        expect(repoConnector.cloneRepo).toBeCalledTimes(1);
        if (element.error) {
            expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Cannot read property 'active' of null");
            expect(jobRepo.updateWithErrorStatus).toBeCalledTimes(1);
        } else {
            expect(job.payload.pathPrefix).toEqual(element.pathPrefix);
            expect(job.payload.mutPrefix).toEqual(element.mutPrefix);
        } 
    })
})

describe.each(TestDataProvider.getManifestPrefixCases())('Validate all Generate manifest prefix cases', (element) => {
    test(`Testing manifest prefix with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        executeCommandWithGivenParamsForManifest(element);
        await prodJobHandler.execute();
        expect(repoConnector.pullRepo).toBeCalledTimes(1);
        expect(repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(job.payload.manifestPrefix).toEqual(element.manifestPrefix);
    })
})

test('Execute Next Gen Manifest prefix generation throws error as get snooty name throws', async () => {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess();
    mockReset(jobCommandExecutor);
    jobCommandExecutor.getSnootyProjectName.calledWith(job.payload.repoName).mockImplementation(() => { throw new Error("Cant get the project name");});
    await prodJobHandler.execute();
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Cant get the project name");
})

describe.each(TestDataProvider.getEnvVarsTestCases())('Validate all set env var cases', (element) => {
    test(`Testing commit check returns ${JSON.stringify(element)}`, async () => {
        job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
        job.payload.aliased = true;
        job.payload.primaryAlias = null;
        setupForSuccess();
        config.get.calledWith('GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION').mockReturnValue(element['GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION']);
        config.get.calledWith('GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN').mockReturnValue(element['GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN']);
        await prodJobHandler.execute();
        verifyNextGenSuccess();
        expect(fileSystemServices.writeToFile).toBeCalledWith(`repos/${job.payload.repoName}/.env.production`, 
                                                              TestDataProvider.getEnvVarsWithPathPrefixWithFlags(job, element['navString'], element['versionString']), 
                                                              {"encoding": "utf8", "flag": "w"})
    })
})

test('Execute Next Gen Build throws error while executing commands', async () => {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess();
    mockReset(jobCommandExecutor);
    jobCommandExecutor.execute.mockReturnValue({status:"failed", error:"Command Execution failed"});
    await prodJobHandler.execute();
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Command Execution failed");
})

test('Execute Next Gen Build throws error when execute throws error', async () => {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess();
    jobCommandExecutor.execute.mockImplementation(() => { throw new Error("Unable to Execute Commands");});
    await prodJobHandler.execute();
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Unable to Execute Commands");
})

test('Execute Next Gen Build throws error when build commands are empty', async () => {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess();
    mockArrayLength(0, job, true, false);
    await prodJobHandler.execute();
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "No commands to execute");
    unMockArrayLength();
})

test('Execute Next Gen Build throws error when deploy commands are empty', async () => {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess();
    mockArrayLength(0, job, false, true);
    await prodJobHandler.execute();
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Failed pushing to Production, No commands to execute");
    unMockArrayLength();
})

describe.each(TestDataProvider.getManifestPrefixCases())('Execute Next Gen Build Validate all deploy commands', (element) => {
    test(`Testing  all deploy command cases with aliased=${element.aliased} primaryAlias=${element.primaryAlias} alias=${element.alias}`, async () => {
        executeCommandWithGivenParamsForManifest(element);
        jobCommandExecutor.execute.mockReturnValue({status:"success", output: "Great work", error:null})
        fileSystemServices.getFilesInDirectory.calledWith(`./${job.payload.repoName}/build/public`, '').mockReturnValue(["1.html", "2.html", "3.html"]);
        await prodJobHandler.execute();
        verifyNextGenSuccess();
        const expectedCommandSet = TestDataProvider.getExpectedProdDeployNextGenCommands(job);
        expect(job.deployCommands).toEqual(expectedCommandSet);
        expect(jobRepo.insertNotificationMessages).toBeCalledWith(job._id,  "Great work");
        expect(fileSystemServices.getFilesInDirectory).toBeCalledWith(`./${job.payload.repoName}/build/public`, '');
        expect(jobRepo.updateWithCompletionStatus).toBeCalledWith(job._id, ["1.html", "2.html", "3.html"]);
    })
})

test('Execute Build succeeded deploy failed updates status properly', async () => {
    setStageForDeployFailure("Not Good");
    await prodJobHandler.execute();
    verifyNextGenSuccess();
    expect(jobRepo.insertNotificationMessages).toBeCalledWith(job._id,  "Bad work");
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Not Good");
})

test('Execute Build succeeded deploy failed with an ERROR updates status properly', async () => {
    setStageForDeployFailure("ERROR:BAD ONE");
    await prodJobHandler.execute();
    verifyNextGenSuccess();
    expect(jobRepo.updateWithErrorStatus).toBeCalledWith(job._id, "Failed pushing to Production: ERROR:BAD ONE");
})

test('Execute Legacy Build runs successfully', async () => {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess(false);
    await prodJobHandler.execute();
    expect(job.payload.isNextGen).toEqual(false);
    expect(job.buildCommands).toEqual(TestDataProvider.getCommonBuildCommands(job));
    expect(job.deployCommands).toEqual(TestDataProvider.getCommonDeployCommands(job));
})

function setStageForDeployFailure(deployError:string) {
    job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(job);
    setupForSuccess();
    jobCommandExecutor.execute.mockReturnValueOnce({status:"success", output: "Great work", error:null});
    jobCommandExecutor.execute.mockReturnValueOnce({status:"Failed", output: "Bad work", error:deployError})
    fileSystemServices.getFilesInDirectory.calledWith(`./${job.payload.repoName}/build/public`, '').mockReturnValue(["1.html", "2.html", "3.html"]);
}

function executeCommandWithGivenParamsForManifest(element:any) {
    job.payload.publishedBranches = element.branchInfo;
    setupForSuccess();
    if (element.aliased !== 'DONTSET') {
        job.payload.aliased = element.aliased;
    }
    if (element.primaryAlias !== 'DONTSET') {
        job.payload.primaryAlias = element.primaryAlias;
    }
    if (element.alias !== 'DONTSET') {
        job.payload.alias = element.alias;
    }
}

function verifyNextGenSuccess(): void {
    const expectedCommandSet = TestDataProvider.getExpectedProdBuildNextGenCommands(job);
    expect(repoConnector.pullRepo).toBeCalledTimes(1);
    expect(repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(repoConnector.checkCommits).toBeCalledTimes(1);
    expect(repoConnector.applyPatch).toBeCalledTimes(1);
    expect(job.buildCommands).toEqual(expectedCommandSet);
    expect(job.payload.isNextGen).toEqual(true);
}

function mockArrayLength(returnValue:Number, job:IJob, buildCommand:boolean=false, deployCommand:boolean = false): void {
    TestableArrayWrapper.prototype.length = jest.fn().mockImplementationOnce( (args) => {
        console.log(`${args}, build?: ${buildCommand}, deploy?: ${deployCommand}`);
        if (buildCommand ) {
            if (args[args.length-1].indexOf("make next-gen-html") >= 0) {
                return 0;
            } else {
                return args.length;
            }
        }
        if (deployCommand) {
            if (args[args.length-1].indexOf("make next-gen-deploy")>= 0) {
                return 0;
            } else {
                return args.length;
            }
        }
    return returnValue; 
});
}

function unMockArrayLength(): void {
    TestableArrayWrapper.prototype.length = lengthPrototype;
}

function setupForSuccess(rootFileExists:boolean = true, nextGenEntry:string = TestDataProvider.nextGenEntryInWorkerFile()):void {
    repoConnector.checkCommits.calledWith(job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(job));
    fileSystemServices.rootFileExists.calledWith(`repos/${job.payload.repoName}/worker.sh`).mockReturnValue(rootFileExists);
    fileSystemServices.readFileAsUtf8.calledWith(`repos/${job.payload.repoName}/worker.sh`).mockReturnValue(nextGenEntry);
    config.get.calledWith('GATSBY_PARSER_USER').mockReturnValue('TestUser');
    jobCommandExecutor.getSnootyProjectName.calledWith(job.payload.repoName).mockReturnValue(job.payload.repoName)
    jobCommandExecutor.execute.mockReturnValue({status:"success", output: "Great work", error:null})
}

})

