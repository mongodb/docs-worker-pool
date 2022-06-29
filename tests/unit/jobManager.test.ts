import { IConfig } from 'config';
import { mockDeep } from 'jest-mock-extended';
import type { Job } from '../../src/entities/job';
import { JobHandlerFactory } from '../../src/job/jobManager';
import { JobValidator } from '../../src/job/jobValidator';
import { JobManager } from '../../src/job/jobManager';
import { JobRepository } from '../../src/repositories/jobRepository';
import { ICDNConnector } from '../../src/services/cdn';
import { IJobCommandExecutor } from '../../src/services/commandExecutor';
import { IFileSystemServices } from '../../src/services/fileServices';
import { IJobRepoLogger } from '../../src/services/logger';
import { IRepoConnector } from '../../src/services/repo';
import { getBuildJobDef } from '../data/jobDef';
import { RepoBranchesRepository } from '../../src/repositories/repoBranchesRepository';

describe('JobManager Tests', () => {
  let job: Job;
  let config: IConfig;
  let jobRepo: JobRepository;
  let fileSystemServices: IFileSystemServices;
  let jobCommandExecutor: IJobCommandExecutor;
  let cdnConnector: ICDNConnector;
  let repoConnector: IRepoConnector;
  let logger: IJobRepoLogger;
  let jobHandlerFactory: JobHandlerFactory;
  let jobManager: JobManager;
  let jobValidator: JobValidator;
  let repoBranchesRepo: RepoBranchesRepository;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(new Date(2021, 4, 3));
    job = getBuildJobDef();
    config = mockDeep<IConfig>();
    jobRepo = mockDeep<JobRepository>();
    fileSystemServices = mockDeep<IFileSystemServices>();
    jobCommandExecutor = mockDeep<IJobCommandExecutor>();
    cdnConnector = mockDeep<ICDNConnector>();
    repoConnector = mockDeep<IRepoConnector>();
    logger = mockDeep<IJobRepoLogger>();
    jobHandlerFactory = mockDeep<JobHandlerFactory>();
    jobValidator = mockDeep<JobValidator>();
    repoBranchesRepo = mockDeep<RepoBranchesRepository>();
    jobManager = new JobManager(
      config,
      jobValidator,
      jobHandlerFactory,
      jobCommandExecutor,
      jobRepo,
      cdnConnector,
      repoConnector,
      fileSystemServices,
      logger,
      repoBranchesRepo
    );
  });

  test('JobManager constructor tests', () => {
    expect(jobManager).toBeDefined();
  });

  describe('JobManager start Tests', () => {
    test('JobManager start stops when it recieves stop signal', async () => {
      jobRepo.getOneQueuedJobAndUpdate.mockResolvedValueOnce(null);
      jobManager.start();
      jobManager.stop();
      jest.runAllTimers();
      expect(jobManager.isStopped()).toBe(true);
    });

    test('JobManager start continues until stop even where there is no valid job signal', async () => {
      jobRepo.getOneQueuedJobAndUpdate.mockResolvedValueOnce(null);
      jobManager.start();
      expect(jobRepo.getOneQueuedJobAndUpdate.mock.calls).toHaveLength(1);
      expect(jobHandlerFactory.createJobHandler.mock.calls).toHaveLength(0);
      jobManager.stop();
      jest.runAllTimers();
    });
  });

  describe('JobManager workex Tests', () => {
    test('JobManager workex doesnt get called when a queued job is not returned', async () => {
      jobRepo.getOneQueuedJobAndUpdate.mockResolvedValueOnce(null);
      jest.spyOn(jobManager, 'workEx');
      jobManager.start();
      expect(jobManager.workEx).not.toHaveBeenCalled();
      jobManager.stop();
      jest.runAllTimers();
    });

    test('JobManager workex updates job status when execution fails', async () => {
      jest.spyOn(jobManager, 'createHandlerAndExecute').mockImplementationOnce(() => {
        throw new Error('Bad!');
      });
      await jobManager.workEx(job);
      expect(jobRepo.updateWithErrorStatus).toHaveBeenCalled();
    });
  });
});
