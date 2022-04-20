import { JobHandlerFactory } from '../../../src/job/jobManager';
import { mockDeep } from 'jest-mock-extended';
import { Job } from '../../../src/entities/job';
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
import { ManifestJobHandler } from '../../../src/job/manifestJobHandler';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';
import { IJobValidator } from '../../../src/job/jobValidator';

describe('JobHandlerFactory Tests', () => {
  let job: Job;
  let config: IConfig;
  let jobRepo: JobRepository;
  let fileSystemServices: IFileSystemServices;
  let jobCommandExecutor: IJobCommandExecutor;
  let cdnConnector: ICDNConnector;
  let repoConnector: IRepoConnector;
  let logger: IJobRepoLogger;
  let jobHandlerFactory: JobHandlerFactory;
  let repoBranchesRepo: RepoBranchesRepository;
  let jobValidator: IJobValidator;

  beforeEach(() => {
    job = mockDeep<Job>();
    config = mockDeep<IConfig>();
    jobRepo = mockDeep<JobRepository>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    cdnConnector = mockDeep<ICDNConnector>();
    repoConnector = mockDeep<IRepoConnector>();
    logger = mockDeep<IJobRepoLogger>();
    jobHandlerFactory = new JobHandlerFactory();
    repoBranchesRepo = mockDeep<RepoBranchesRepository>();
  });

  test('Construct Job Factory', () => {
    expect(new JobHandlerFactory()).toBeDefined();
  });

  test('Unknown jobtype throws error', () => {
    job.payload.jobType = 'Unknown';
    expect(() => {
      jobHandlerFactory.createJobHandler(
        job,
        config,
        jobRepo,
        fileSystemServices,
        jobCommandExecutor,
        cdnConnector,
        repoConnector,
        logger,
        jobValidator,
        repoBranchesRepo
      );
    }).toThrowError('Job type not supported');
  });

  test('jobHandlerFactory correctly associates known jobTypes and handlers', () => {
    const m = {
      githubPush: StagingJobHandler,
      manifestGeneration: ManifestJobHandler,
      productionDeploy: ProductionJobHandler,
      regression: RegressionJobHandler,
    };
    for (const jt in m) {
      job.payload.jobType = jt;
      const handler = jobHandlerFactory.createJobHandler(
        job,
        config,
        jobRepo,
        fileSystemServices,
        jobCommandExecutor,
        cdnConnector,
        repoConnector,
        logger,
        jobValidator,
        repoBranchesRepo
      );
      expect(handler).toBeInstanceOf(m[jt]);
    }
  });
});
