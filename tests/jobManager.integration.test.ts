import c from 'config';
import { JobHandlerFactory, JobManager } from '../src/job/jobManager';
import { JobValidator } from '../src/job/jobValidator';
import { JobRepository } from '../src/repositories/jobRepository';
import { RepoEntitlementsRepository } from '../src/repositories/repoEntitlementsRepository';
import { RepoBranchesRepository } from '../src/repositories/repoBranchesRepository';
import { FastlyConnector } from '../src/services/cdn';
import { GithubCommandExecutor, JobSpecificCommandExecutor } from '../src/services/commandExecutor';
import { FileSystemServices } from '../src/services/fileServices';
import { ConsoleLogger, HybridJobLogger } from '../src/services/logger';
import { GitHubConnector } from '../src/services/repo';
import { TestDBManager } from './mongo/testDBManager';

import fs from 'fs-extra';

let testDBManager: TestDBManager;

beforeAll(async () => {
  testDBManager = new TestDBManager();
  await testDBManager.start();
});

afterAll(async () => {
  await testDBManager.stop();
  fs.removeSync('repos');
});

describe('Jobmanager integration Tests', () => {
  let consoleLogger: ConsoleLogger;
  let githubCommandExecutor: GithubCommandExecutor;
  let repoEntitlementRepository: RepoEntitlementsRepository;

  // Init for JobManager
  let cdnConnector: FastlyConnector;
  let fileSystemServices: FileSystemServices;
  let jobCommandExecutor: JobSpecificCommandExecutor;
  let jobHandlerFactory: JobHandlerFactory;
  let jobRepository: JobRepository;
  let jobValidator: JobValidator;
  let hybridJobLogger: HybridJobLogger;
  let repoBranchesRepo: RepoBranchesRepository;
  let repoConnector: GitHubConnector;
  let jobManager: JobManager;
  beforeEach(() => {
    consoleLogger = new ConsoleLogger();
    githubCommandExecutor = new GithubCommandExecutor();
    repoEntitlementRepository = new RepoEntitlementsRepository(testDBManager.db, c, consoleLogger);

    cdnConnector = new FastlyConnector(hybridJobLogger);
    fileSystemServices = new FileSystemServices();
    jobCommandExecutor = new JobSpecificCommandExecutor();
    jobHandlerFactory = new JobHandlerFactory();
    jobRepository = new JobRepository(testDBManager.db, c, consoleLogger);
    jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepo);
    hybridJobLogger = new HybridJobLogger(jobRepository);
    repoBranchesRepo = new RepoBranchesRepository(testDBManager.db, c, consoleLogger);
    repoConnector = new GitHubConnector(githubCommandExecutor, c, fileSystemServices, hybridJobLogger);
    jobManager = new JobManager(
      cdnConnector,
      c, // config
      fileSystemServices,
      jobCommandExecutor,
      jobHandlerFactory,
      jobRepository,
      jobValidator,
      hybridJobLogger,
      repoBranchesRepo,
      repoConnector
    );
  });
  // TODO: Do we need to implement startSingleJob?
  test('E2E runs without any error if no job is present', async () => {
    await jobManager.startSingleJob();
  });
});
