import { IConfig } from "config";
import { mockDeep } from "jest-mock-extended";
import { IJob } from "../../src/entities/job";
import { ProductionJobHandler } from "../../src/job/productionJobHandler";
import { StagingJobHandler } from "../../src/job/stagingJobHandler";
import { JobRepository } from "../../src/repositories/jobRepository";
import { ICDNConnector } from "../../src/services/cdn";
import { IJobCommandExecutor } from "../../src/services/commandExecutor";
import { IFileSystemServices } from "../../src/services/fileServices";
import { IJobRepoLogger } from "../../src/services/logger";
import { IRepoConnector } from "../../src/services/repo";
import { TestDataProvider } from "../data/data";
import * as data from '../data/jobDef';

export class JobHandlerTestHelper {

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
        this.job = JSON.parse(JSON.stringify(data.default.value));
        this.config = mockDeep<IConfig>();
        this.jobRepo = mockDeep<JobRepository>();
        this.fileSystemServices = mockDeep<IFileSystemServices>();
        this.jobCommandExecutor = mockDeep<IJobCommandExecutor>();
        this.cdnConnector = mockDeep<ICDNConnector>();
        this.repoConnector = mockDeep<IRepoConnector>();
        this.logger = mockDeep<IJobRepoLogger>();
        this.jobHandler = new this.handlerMapper[handlerName](this.job, this.config, this.jobRepo, this.fileSystemServices, this.jobCommandExecutor, this.cdnConnector, this.repoConnector, this.logger);
        return this.jobHandler;
    }
    setStageForDeploySuccess(isNextGen:boolean = true, prodDeploy:boolean = true): string[] {
        this.job.payload.urlSlug = TestDataProvider.getBranchSlug(this.job);
        this.setupForSuccess(isNextGen);
        const publishOutput = TestDataProvider.getPublishOutputWithPurgedUrls(prodDeploy);
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "success", output: "Great work", error: null });
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "Failed", output: publishOutput[0], error: null })
        return publishOutput[1]; //return urls
    }

    setStageForDeployFailure(deployOutput: string | null, deployError: string) {
        this.job.payload.urlSlug = TestDataProvider.getBranchSlug(this.job);
        this.setupForSuccess();
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "success", output: "Great work", error: null });
        this.jobCommandExecutor.execute.mockReturnValueOnce({ status: "Failed", output: deployOutput, error: deployError })
        this.fileSystemServices.getFilesInDirectory.calledWith(`./${this.job.payload.repoName}/build/public`, '').mockReturnValue(["1.html", "2.html", "3.html"]);
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
    
    setupForSuccess(rootFileExists: boolean = true, nextGenEntry: string = TestDataProvider.nextGenEntryInWorkerFile()): void {
        this.config.get.calledWith('repo_dir').mockReturnValue('repos');
        this.config.get.calledWith('stage').mockReturnValue('test');
        this.repoConnector.checkCommits.calledWith(this.job).mockReturnValue(TestDataProvider.getCommitCheckValidResponse(this.job));
        this.repoConnector.cloneRepo.calledWith(this.job, 'repos').mockReturnValue({});
        this.fileSystemServices.rootFileExists.calledWith(`repos/${this.job.payload.repoName}/worker.sh`).mockReturnValue(rootFileExists);
        this.fileSystemServices.readFileAsUtf8.calledWith(`repos/${this.job.payload.repoName}/worker.sh`).mockReturnValue(nextGenEntry);
        this.config.get.calledWith('GATSBY_PARSER_USER').mockReturnValue('TestUser');
        this.jobCommandExecutor.execute.mockReturnValue({ status: "success", output: "Great work", error: null })
    }

}