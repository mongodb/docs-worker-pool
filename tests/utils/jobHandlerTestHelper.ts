import { IConfig } from 'config';
import { mockDeep } from 'jest-mock-extended';
import type { Job } from '../../src/entities/job';
import { IJobValidator } from '../../src/job/jobValidator';
import { ProductionJobHandler } from '../../src/job/productionJobHandler';
import { StagingJobHandler } from '../../src/job/stagingJobHandler';
import { ManifestJobHandler } from '../../src/job/manifestJobHandler';
import { JobRepository } from '../../src/repositories/jobRepository';
import { RepoBranchesRepository } from '../../src/repositories/repoBranchesRepository';
import { DocsetsRepository } from '../../src/repositories/docsetsRepository';
import { RepoEntitlementsRepository } from '../../src/repositories/repoEntitlementsRepository';
import { ICDNConnector } from '../../src/services/cdn';
import { IJobCommandExecutor } from '../../src/services/commandExecutor';
import { IFileSystemServices } from '../../src/services/fileServices';
import { IJobRepoLogger } from '../../src/services/logger';
import { IRepoConnector } from '../../src/services/repo';
import { TestDataProvider } from '../data/data';
import { getBuildJobDef, getManifestJobDef, getStagingJobDef } from '../data/jobDef';

type MockReturnValueOnce = { status: string; output: string; error: string | null };
type SetupOptions = {
  hasGatsbySiteId?: boolean;
  hasNetlifyBuildHook?: boolean;
};

export class JobHandlerTestHelper {
  job: Job;
  config: IConfig;
  jobRepo: JobRepository;
  fileSystemServices: IFileSystemServices;
  jobCommandExecutor: IJobCommandExecutor;
  cdnConnector: ICDNConnector;
  repoConnector: IRepoConnector;
  logger: IJobRepoLogger;
  jobHandler: ProductionJobHandler | StagingJobHandler | ManifestJobHandler;
  jobValidator: IJobValidator;
  repoBranchesRepo: RepoBranchesRepository;
  docsetsRepo: DocsetsRepository;
  repoEntitlementsRepo: RepoEntitlementsRepository;
  lengthPrototype;
  handlerMapper = {
    prod: ProductionJobHandler,
    staging: StagingJobHandler,
    manifest: ManifestJobHandler,
  };

  init(handlerName: string): ProductionJobHandler | StagingJobHandler | ManifestJobHandler {
    if (handlerName === 'manifest') {
      this.job = getManifestJobDef();
    } else if (handlerName === 'staging') {
      this.job = getStagingJobDef();
    } else {
      this.job = getBuildJobDef();
    }
    this.config = mockDeep<IConfig>();
    this.jobRepo = mockDeep<JobRepository>();
    this.fileSystemServices = mockDeep<IFileSystemServices>();
    this.jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    this.cdnConnector = mockDeep<ICDNConnector>();
    this.repoConnector = mockDeep<IRepoConnector>();
    this.logger = mockDeep<IJobRepoLogger>();
    this.jobValidator = mockDeep<IJobValidator>();
    this.repoBranchesRepo = mockDeep<RepoBranchesRepository>();
    this.docsetsRepo = mockDeep<DocsetsRepository>();
    this.repoEntitlementsRepo = mockDeep<RepoEntitlementsRepository>();
    this.jobHandler = new this.handlerMapper[handlerName](
      this.job,
      this.config,
      this.jobRepo,
      this.fileSystemServices,
      this.jobCommandExecutor,
      this.cdnConnector,
      this.repoConnector,
      this.logger,
      this.jobValidator,
      this.repoBranchesRepo,
      this.docsetsRepo,
      this.repoEntitlementsRepo
    );
    return this.jobHandler;
  }

  setStageForDeploySuccess(
    prodDeploy = true,
    returnValue?: MockReturnValueOnce,
    setupOptions: SetupOptions = {}
  ): string[] {
    this.job.payload.repoBranches = TestDataProvider.getPublishBranchesContent(this.job);
    this.setupForSuccess();
    const publishOutput = TestDataProvider.getPublishOutputWithPurgedUrls(prodDeploy);

    const { hasGatsbySiteId, hasNetlifyBuildHook } = setupOptions;
    if (hasGatsbySiteId) {
      this.repoEntitlementsRepo.getGatsbySiteIdByGithubUsername.mockResolvedValue('gatsby_site_id');
    }
    if (hasNetlifyBuildHook) {
      this.repoEntitlementsRepo.getNetlifyBuildHookByGithubUsername.mockResolvedValue('netlify_build_hook');
    }

    if (returnValue) {
      this.jobCommandExecutor.execute.mockResolvedValue(returnValue);
    } else {
      this.jobCommandExecutor.execute.mockResolvedValue({ status: 'success', output: publishOutput[0], error: null });
    }
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
  }

  verifyManifestSuccess(): void {
    const expectedCommandSet = TestDataProvider.getExpectedManifestBuildNextGenCommands(this.job);
    expect(this.repoConnector.pullRepo).toBeCalledTimes(1);
    expect(this.repoConnector.cloneRepo).toBeCalledTimes(1);
    expect(this.repoConnector.checkCommits).toBeCalledTimes(1);
    expect(this.repoConnector.applyPatch).toBeCalledTimes(1);
    expect(this.job.buildCommands).toEqual(expectedCommandSet);
  }

  setupForSuccess(rootFileExists = true, nextGenEntry: string = TestDataProvider.nextGenEntryInWorkerFile()): void {
    this.config.get.calledWith('repo_dir').mockReturnValue('repos');
    this.config.get.calledWith('stage').mockReturnValue('test');
    this.config.get.calledWith('gatsbyBaseUrl').mockReturnValue('test');
    this.config.get.calledWith('previewBuildEnabled').mockReturnValue('false');
    this.config.get.calledWith('featureFlagSearchUI').mockReturnValue('false');
    this.config.get.calledWith('gatsbyHideUnifiedFooterLocale').mockReturnValue('true');
    this.config.get.calledWith('gatsbyMarianURL').mockReturnValue('test-url');
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
    this.config.get.calledWith('gatsbyEnableDarkMode').mockReturnValue('true');
    this.config.get.calledWith('gatsbyFeatureShowHiddenLocales').mockReturnValue('true');
    this.jobCommandExecutor.execute.mockResolvedValue({ status: 'success', output: 'Great work', error: null });
  }
}
