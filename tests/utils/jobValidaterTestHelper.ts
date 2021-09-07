import { IConfig } from "config";
import { mockDeep } from "jest-mock-extended";
import { IJob } from "../../entities/job";
import TestableArrayWrapper from "../../job/ITestableTypeWrapper";
import { ProductionJobHandler } from "../../job/productionJobHandler";
import { StagingJobHandler } from "../../job/stagingJobHandler";
import { JobRepository } from "../../repositories/jobRepository";
import { ICDNConnector } from "../../services/cdn";
import { IJobCommandExecutor } from "../../services/commandExecutor";
import { IFileSystemServices } from "../../services/fileServices";
import { IJobRepoLogger } from "../../services/logger";
import { IRepoConnector } from "../../services/repo";
import { TestDataProvider } from "../data/data";
import * as data from '../data/jobDef';

export class JobValidatorTestHelper {

    job: IJob;
    config: IConfig;
    jobRepo: JobRepository;
    fileSystemServices: IFileSystemServices;
    jobCommandExecutor: IJobCommandExecutor;
    cdnConnector: ICDNConnector;
    repoConnector: IRepoConnector;
    logger: IJobRepoLogger;
    jobHandler: ProductionJobHandler | StagingJobHandler;
    lengthPrototype;
    handlerMapper = {
        "prod": ProductionJobHandler,
        "staging": StagingJobHandler
    }

    init(handlerName: string): ProductionJobHandler | StagingJobHandler {
        this.job = JSON.parse(JSON.stringify(data.default));
        this.config = mockDeep<IConfig>();
        this.jobRepo = mockDeep<JobRepository>();
        this.fileSystemServices = mockDeep<IFileSystemServices>();
        this.jobCommandExecutor = mockDeep<IJobCommandExecutor>();
        this.cdnConnector = mockDeep<ICDNConnector>();
        this.repoConnector = mockDeep<IRepoConnector>();
        this.logger = mockDeep<IJobRepoLogger>();
        this.lengthPrototype = TestableArrayWrapper.prototype.length;
        this.jobHandler = new this.handlerMapper[handlerName](this.job, this.config, this.jobRepo, this.fileSystemServices, this.jobCommandExecutor, this.cdnConnector, this.repoConnector, this.logger);
        return this.jobHandler;
    }
    setStageForDeploySuccess(isNextGen:boolean = true): string[] {
        this.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(this.job);
        this.setupForSuccess(isNextGen);
        const publishOutput = TestDataProvider.getPublishOutputWithPurgedUrls();
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "success", output: "Great work", error: null });
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "Failed", output: publishOutput[0], error: null })
        return publishOutput[1]; //return urls
    }

    setStageForDeployFailure(deployOutput: string | null, deployError: string) {
        this.job.payload.publishedBranches = TestDataProvider.getPublishBranchesContent(this.job);
        this.setupForSuccess();
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "success", output: "Great work", error: null });
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "Failed", output: deployOutput, error: deployError })
        this.fileSystemServices.getFilesInDirectory.calledWith(`./${this.job.payload.repoName}/build/public`, '').mockReturnValue(["1.html", "2.html", "3.html"]);
    }

    executeCommandWithGivenParamsForManifest(element: any) {
        this.job.payload.publishedBranches = element.branchInfo;
        this.setupForSuccess();
        if (element.aliased !== 'DONTSET') {
            this.job.payload.aliased = element.aliased;
        }
        if (element.primaryAlias !== 'DONTSET') {
            this.job.payload.primaryAlias = element.primaryAlias;
        }
        if (element.alias !== 'DONTSET') {
            this.job.payload.alias = element.alias;
        }
    }

    verifyNextGenSuccess(): void {
        const expectedCommandSet = TestDataProvider.getExpectedProdBuildNextGenCommands(this.job);
        expect(this.repoConnector.pullRepo).toBeCalledTimes(1);
        expect(this.repoConnector.cloneRepo).toBeCalledTimes(1);
        expect(this.repoConnector.checkCommits).toBeCalledTimes(1);
        expect(this.repoConnector.applyPatch).toBeCalledTimes(1);
        expect(this.job.buildCommands).toEqual(expectedCommandSet);
        expect(this.job.payload.isNextGen).toEqual(true);
    }

    mockArrayLength(returnValue: Number, job: IJob, buildCommand: boolean = false, deployCommand: boolean = false): void {
        TestableArrayWrapper.prototype.length = jest.fn().mockImplementationOnce((args) => {
            console.log(`${args}, build?: ${buildCommand}, deploy?: ${deployCommand}`);
            if (buildCommand) {
                if (args[args.length - 1].indexOf("make next-gen-html") >= 0) {
                    return 0;
                } else {
                    return args.length;
                }
            }
            if (deployCommand) {
                if (args[args.length - 1].indexOf("make next-gen-deploy") >= 0) {
                    return 0;
                } else {
                    return args.length;
                }
            }
            return returnValue;
        });
    }

    unMockArrayLength(): void {
        TestableArrayWrapper.prototype.length = this.lengthPrototype;
    }

    setupForSuccess(rootFileExists: boolean = true, nextGenEntry: string = TestDataProvider.nextGenEntryInWorkerFile()): void {
        this.repoConnector.checkCommits.calledWith(this.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(this.job));
        this.fileSystemServices.rootFileExists.calledWith(`repos/${this.job.payload.repoName}/worker.sh`).mockReturnValue(rootFileExists);
        this.fileSystemServices.readFileAsUtf8.calledWith(`repos/${this.job.payload.repoName}/worker.sh`).mockReturnValue(nextGenEntry);
        this.config.get.calledWith('GATSBY_PARSER_USER').mockReturnValue('TestUser');
        this.jobCommandExecutor.getSnootyProjectName.calledWith(this.job.payload.repoName).mockReturnValue(this.job.payload.repoName)
        this.jobCommandExecutor.execute.mockReturnValue({ status: "success", output: "Great work", error: null })
    }

}