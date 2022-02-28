import { JobHandlerFactory } from '../../../src/job/jobManager';
import { mockDeep } from 'jest-mock-extended';
import { IJob } from '../../../src/entities/job';
import { IConfig } from 'config';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { IFileSystemServices } from '../../../src/services/fileServices';
import { IJobCommandExecutor } from '../../../src/services/commandExecutor';
import { ICDNConnector } from '../../../src/services/cdn';
import { IRepoConnector } from '../../../src/services/repo';
import { IJobRepoLogger } from '../../../src/services/logger';
import { ProductionJobHandler } from '../../../src/job/productionJobHandler';
import { RegressionJobHandler } from '../../../src/job/regressionJobHandler';
import { StagingJobHandler } from '../../../src/job/stagingJobHandler';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { IJobValidator, JobValidator } from '../../../src/job/jobValidator';

describe('JobHandlerFactory Tests', () => {
  let job: IJob;
  let cdnConnector: ICDNConnector;
  let config: IConfig;
  let fileSystemServices: IFileSystemServices;
  let jobCommandExecutor: IJobCommandExecutor;
  let jobHandlerFactory: JobHandlerFactory;
  let jobRepo: JobRepository;
  let jobValidator: IJobValidator;
  let logger: IJobRepoLogger;
  let repoBranchesRepo: RepoBranchesRepository;
  let repoConnector: IRepoConnector;

  beforeEach(() => {
    job = mockDeep<IJob>();
    cdnConnector = mockDeep<ICDNConnector>();
    config = mockDeep<IConfig>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    jobHandlerFactory = new JobHandlerFactory();
    jobRepo = mockDeep<JobRepository>();
    jobValidator = mockDeep<JobValidator>();
    logger = mockDeep<IJobRepoLogger>();
    repoBranchesRepo = mockDeep<RepoBranchesRepository>();
    repoConnector = mockDeep<IRepoConnector>();
  });

  test('Construct Job Factory', () => {
    expect(new JobHandlerFactory()).toBeDefined();
  });

  test('Unknown jobtype throws error', () => {
    job.payload.jobType = 'Unknown';
    expect(() => {
      jobHandlerFactory.createJobHandler(
        job,
        cdnConnector,
        config,
        fileSystemServices,
        jobCommandExecutor,
        jobRepo,
        jobValidator,
        logger,
        repoBranchesRepo,
        repoConnector
      );
    }).toThrowError(`Job type 'Unknown' not supported`);
  });

  test('regression jobtype returns regression handler', () => {
    job.payload.jobType = 'regression';
    const handler = jobHandlerFactory.createJobHandler(
      job,
      cdnConnector,
      config,
      fileSystemServices,
      jobCommandExecutor,
      jobRepo,
      jobValidator,
      logger,
      repoBranchesRepo,
      repoConnector
    );
    expect(handler).toBeInstanceOf(RegressionJobHandler);
  });

  test('githubPush jobtype returns Staging handler', () => {
    job.payload.jobType = 'githubPush';
    const handler = jobHandlerFactory.createJobHandler(
      job,
      cdnConnector,
      config,
      fileSystemServices,
      jobCommandExecutor,
      jobRepo,
      jobValidator,
      logger,
      repoBranchesRepo,
      repoConnector
    );
    expect(handler).toBeInstanceOf(StagingJobHandler);
  });

  test('productionDeploy jobtype returns Production handler', () => {
    job.payload.jobType = 'productionDeploy';
    const handler = jobHandlerFactory.createJobHandler(
      job,
      cdnConnector,
      config,
      fileSystemServices,
      jobCommandExecutor,
      jobRepo,
      jobValidator,
      logger,
      repoBranchesRepo,
      repoConnector
    );
    expect(handler).toBeInstanceOf(ProductionJobHandler);
  });
});
