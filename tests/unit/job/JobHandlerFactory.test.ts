import { JobHandlerFactory } from '../../../src/job/jobHandlerFactory';
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

describe('JobHandlerFactory Tests', () => {
  let job: IJob;
  let config: IConfig;
  let jobRepo: JobRepository;
  let fileSystemServices: IFileSystemServices;
  let jobCommandExecutor: IJobCommandExecutor;
  let cdnConnector: ICDNConnector;
  let repoConnector: IRepoConnector;
  let logger: IJobRepoLogger;
  let jobHandlerFactory: JobHandlerFactory;

  beforeEach(() => {
    job = mockDeep<IJob>();
    config = mockDeep<IConfig>();
    jobRepo = mockDeep<JobRepository>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    cdnConnector = mockDeep<ICDNConnector>();
    repoConnector = mockDeep<IRepoConnector>();
    logger = mockDeep<IJobRepoLogger>();
    jobHandlerFactory = new JobHandlerFactory();
  })

  test('Construct Job Factory', () => {
    expect(new JobHandlerFactory()).toBeDefined();
  })

  test('Unknown jobtype throws error', () => {
    job.payload.jobType = "Unknown";
    expect(() => { 
      jobHandlerFactory.createJobHandler(job, config, jobRepo, fileSystemServices, jobCommandExecutor, cdnConnector, repoConnector, logger)
    }).toThrowError('Job type not supported');
  })

  test('regression jobtype returns regression handler', () => {
    job.payload.jobType = "regression";
    const handler = jobHandlerFactory.createJobHandler(job, config, jobRepo, fileSystemServices, jobCommandExecutor, cdnConnector, repoConnector, logger);
    expect(handler).toBeInstanceOf(RegressionJobHandler);
  })

  test('githubPush jobtype returns Staging handler', () => {
    job.payload.jobType = "githubPush";
    const handler = jobHandlerFactory.createJobHandler(job, config, jobRepo, fileSystemServices, jobCommandExecutor, cdnConnector, repoConnector, logger);
    expect(handler).toBeInstanceOf(StagingJobHandler);
  })

  test('productionDeploy jobtype returns Production handler', () => {
    job.payload.jobType = "productionDeploy";
    const handler = jobHandlerFactory.createJobHandler(job, config, jobRepo, fileSystemServices, jobCommandExecutor, cdnConnector, repoConnector, logger);
    expect(handler).toBeInstanceOf(ProductionJobHandler);
  })
})