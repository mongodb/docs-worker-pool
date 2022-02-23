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
import { IJobValidator } from '../../../src/job/jobValidator';

describe('JobHandlerFactory Tests', () => {
  let job: IJob;
  let cdnConnector: ICDNConnector;
  let commandExecutor: IJobCommandExecutor;
  let config: IConfig;
  let fileSystemServices: IFileSystemServices;
  let jobHandlerFactory: JobHandlerFactory;
  let jobRepo: JobRepository;
  let logger: IJobRepoLogger;
  let repoBranchesRepo: RepoBranchesRepository;
  let repoConnector: IRepoConnector;
  let validator: IJobValidator;

  beforeEach(() => {
    job = mockDeep<IJob>();
    cdnConnector = mockDeep<ICDNConnector>();
    commandExecutor = mockDeep<IJobCommandExecutor>();
    config = mockDeep<IConfig>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobHandlerFactory = new JobHandlerFactory();
    jobRepo = mockDeep<JobRepository>();
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
        commandExecutor,
        config,
        fileSystemServices,
        jobRepo,
        logger,
        repoBranchesRepo,
        repoConnector,
        validator
      );
    }).toThrowError(`Job type 'Unknown' not supported`);
  });

  test('regression jobtype returns regression handler', () => {
    job.payload.jobType = 'regression';
    const handler = jobHandlerFactory.createJobHandler(
      job,
      cdnConnector,
      commandExecutor,
      config,
      fileSystemServices,
      jobRepo,
      logger,
      repoBranchesRepo,
      repoConnector,
      validator
    );
    expect(handler).toBeInstanceOf(RegressionJobHandler);
  });

  test('githubPush jobtype returns Staging handler', () => {
    job.payload.jobType = 'githubPush';
    const handler = jobHandlerFactory.createJobHandler(
      job,
      cdnConnector,
      commandExecutor,
      config,
      fileSystemServices,
      jobRepo,
      logger,
      repoBranchesRepo,
      repoConnector,
      validator
    );
    expect(handler).toBeInstanceOf(StagingJobHandler);
  });

  test('productionDeploy jobtype returns Production handler', () => {
    job.payload.jobType = 'productionDeploy';
    const handler = jobHandlerFactory.createJobHandler(
      job,
      cdnConnector,
      commandExecutor,
      config,
      fileSystemServices,
      jobRepo,
      logger,
      repoBranchesRepo,
      repoConnector,
      validator
    );
    expect(handler).toBeInstanceOf(ProductionJobHandler);
  });
});
