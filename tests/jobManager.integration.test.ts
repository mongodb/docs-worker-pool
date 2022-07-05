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
  let fileSystemServices: FileSystemServices;
  let jobCommandExecutor: JobSpecificCommandExecutor;
  let githubCommandExecutor: GithubCommandExecutor;
  let jobRepository: JobRepository;
  let hybridJobLogger: HybridJobLogger;
  let repoEntitlementRepository: RepoEntitlementsRepository;
  let repoBranchesRepository: RepoBranchesRepository;
  let jobValidator: JobValidator;
  let cdnConnector: FastlyConnector;
  let repoConnector: GitHubConnector;
  let jobHandlerFactory: JobHandlerFactory;
  let jobManager: JobManager;
  beforeEach(() => {
    consoleLogger = new ConsoleLogger();
    fileSystemServices = new FileSystemServices();
    jobCommandExecutor = new JobSpecificCommandExecutor();
    githubCommandExecutor = new GithubCommandExecutor();
    jobRepository = new JobRepository(testDBManager.db, c, consoleLogger);
    hybridJobLogger = new HybridJobLogger(jobRepository);
    repoEntitlementRepository = new RepoEntitlementsRepository(testDBManager.db, c, consoleLogger);
    repoBranchesRepository = new RepoBranchesRepository(testDBManager.db, c, consoleLogger);
    jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepository);
    cdnConnector = new FastlyConnector(hybridJobLogger);
    repoConnector = new GitHubConnector(githubCommandExecutor, c, fileSystemServices, hybridJobLogger);
    jobHandlerFactory = new JobHandlerFactory();
    jobManager = new JobManager(
      c,
      jobValidator,
      jobHandlerFactory,
      jobCommandExecutor,
      jobRepository,
      cdnConnector,
      repoConnector,
      fileSystemServices,
      hybridJobLogger,
      repoBranchesRepository
    );
  });

  test('E2E runs without any error if no job is present', async () => {
    jest.spyOn(global.console, 'error').mockImplementation(() => {
      /* do nothing */
    });
    await jobManager.startSpecificJob('not-a-job');
    expect(console.error).toBeCalled();
  });
});
