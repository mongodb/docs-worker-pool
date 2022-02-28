import { IConfig } from 'config';
import { mockDeep } from 'jest-mock-extended';
import { ICDNConnector } from '../../src/services/cdn';
import { IFileSystemServices } from '../../src/services/fileServices';
import { IJob } from '../../src/entities/job';
import { IJobCommandExecutor } from '../../src/services/commandExecutor';
import { IJobRepoLogger } from '../../src/services/logger';
import { IJobValidator } from '../../src/job/jobValidator';
import { IRepoConnector } from '../../src/services/repo';
import { JobRepository } from '../../src/repositories/jobRepository';
import { ProductionJobHandler } from '../../src/job/productionJobHandler';
import { RepoBranchesRepository } from '../../src/repositories/repoBranchesRepository';
import { StagingJobHandler } from '../../src/job/stagingJobHandler';
import { TestDataProvider } from '../data/data';
import * as data from '../data/jobDef';

export class JobHandlerTestHelper {
  job: IJob;
  cdnConnector: ICDNConnector;
  config: IConfig;
  fileSystemServices: IFileSystemServices;
  jobCommandExecutor: IJobCommandExecutor;
  jobHandler: ProductionJobHandler | StagingJobHandler;
  jobRepo: JobRepository;
  jobValidator: IJobValidator;
  logger: IJobRepoLogger;
  repoBranchesRepo: RepoBranchesRepository;
  repoConnector: IRepoConnector;
  lengthPrototype;
  handlerMapper = {
    prod: ProductionJobHandler,
    staging: StagingJobHandler,
  };

  init(handlerName: string): ProductionJobHandler | StagingJobHandler {
    this.job = JSON.parse(JSON.stringify(data.default.value));
    this.cdnConnector = mockDeep<ICDNConnector>();
    this.config = mockDeep<IConfig>();
    this.fileSystemServices = mockDeep<IFileSystemServices>();
    this.jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    this.jobRepo = mockDeep<JobRepository>();
    this.jobValidator = mockDeep<IJobValidator>();
    this.logger = mockDeep<IJobRepoLogger>();
    this.repoBranchesRepo = mockDeep<RepoBranchesRepository>();
    this.repoConnector = mockDeep<IRepoConnector>();
    this.jobHandler = new this.handlerMapper[handlerName](
      this.job,
      this.cdnConnector,
      this.config,
      this.fileSystemServices,
      this.jobCommandExecutor,
      this.jobRepo,
      this.jobValidator,
      this.logger,
      this.repoBranchesRepo,
      this.repoConnector
    );
    return this.jobHandler;
  }
  setStageForDeploySuccess(isNextGen = true, prodDeploy = true): string[] {
    this.job.payload.repoBranches = TestDataProvider.getPublishBranchesContent(this.job);
    this.setupForSuccess(isNextGen);
    const publishOutput = TestDataProvider.getPublishOutputWithPurgedUrls(prodDeploy);
    this.jobCommandExecutor.execute.mockReturnValueOnce({ status: 'success', output: 'Great work', error: null });
    this.jobCommandExecutor.execute.mockReturnValueOnce({ status: 'Failed', output: publishOutput[0], error: null });
    return publishOutput[1]; //return urls
  }

  setStageForDeployFailure(deployOutput: string | null, deployError: string) {
    this.job.payload.repoBranches = TestDataProvider.getPublishBranchesContent(this.job);
    this.setupForSuccess();
    this.jobCommandExecutor.execute.mockReturnValueOnce({ status: 'success', output: 'Great work', error: null });
    this.jobCommandExecutor.execute.mockReturnValueOnce({ status: 'Failed', output: deployOutput, error: deployError });
    this.fileSystemServices.getFilesInDirectory
      .calledWith(`./${this.job.payload.repoName}/build/public`, '')
      .mockReturnValue(['1.html', '2.html', '3.html']);
  }

  executeCommandWithGivenParamsForManifest(element: any) {
    this.job.payload.repoBranches = element.branchInfo;
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

  setupForSuccess(rootFileExists = true, nextGenEntry: string = TestDataProvider.nextGenEntryInWorkerFile()): void {
    this.config.get.calledWith('repo_dir').mockReturnValue('repos');
    this.config.get.calledWith('stage').mockReturnValue('test');
    this.repoConnector.checkCommits
      .calledWith(this.job)
      .mockReturnValue(TestDataProvider.getCommitCheckValidResponse(this.job));
    this.repoConnector.cloneRepo.calledWith(this.job, 'repos').mockReturnValue({});
    this.fileSystemServices.rootFileExists
      .calledWith(`repos/${this.job.payload.repoName}/worker.sh`)
      .mockReturnValue(rootFileExists);
    this.fileSystemServices.readFileAsUtf8
      .calledWith(`repos/${this.job.payload.repoName}/worker.sh`)
      .mockReturnValue(nextGenEntry);
    this.config.get.calledWith('GATSBY_PARSER_USER').mockReturnValue('TestUser');
    this.jobCommandExecutor.getSnootyProjectName
      .calledWith(this.job.payload.repoName)
      .mockReturnValue({ output: this.job.payload.repoName });
    this.jobCommandExecutor.execute.mockReturnValue({ status: 'success', output: 'Great work', error: null });
  }
}
