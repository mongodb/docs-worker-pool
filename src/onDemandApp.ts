import { JobManager, JobHandlerFactory } from './job/jobManager';
import { FastlyConnector } from './services/cdn';
import { GitHubConnector } from './services/repo';
import { HybridJobLogger, ConsoleLogger } from './services/logger';
import { GithubCommandExecutor, JobSpecificCommandExecutor } from './services/commandExecutor';
import { JobRepository } from './repositories/jobRepository';
import { RepoEntitlementsRepository } from './repositories/repoEntitlementsRepository';
import c from 'config';
import * as mongodb from 'mongodb';
import { FileSystemServices } from './services/fileServices';
import { JobValidator } from './job/jobValidator';
import { RepoBranchesRepository } from './repositories/repoBranchesRepository';

let db: mongodb.Db;
let consoleLogger: ConsoleLogger;
let fileSystemServices: FileSystemServices;
let jobCommandExecutor: JobSpecificCommandExecutor;
let githubCommandExecutor: GithubCommandExecutor;
let jobRepository: JobRepository;
let hybridJobLogger: HybridJobLogger;
let repoEntitlementRepository: RepoEntitlementsRepository;
let jobValidator: JobValidator;
let cdnConnector: FastlyConnector;
let repoConnector: GitHubConnector;
let jobHandlerFactory: JobHandlerFactory;
let jobManager: JobManager;
let repoBranchesRepo: RepoBranchesRepository;

async function init(): Promise<void> {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  db = client.db(c.get('dbName'));
  consoleLogger = new ConsoleLogger();
  githubCommandExecutor = new GithubCommandExecutor();
  repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);

  // for jobManager
  cdnConnector = new FastlyConnector(consoleLogger);
  fileSystemServices = new FileSystemServices();
  hybridJobLogger = new HybridJobLogger(jobRepository);
  jobCommandExecutor = new JobSpecificCommandExecutor();
  jobHandlerFactory = new JobHandlerFactory();
  jobRepository = new JobRepository(db, c, consoleLogger);
  jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepo);
  repoBranchesRepo = new RepoBranchesRepository(db, c, consoleLogger);
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
  try {
    await jobManager.startSpecificJob(c.get('jobId'));
  } catch (err) {
    consoleLogger.info('onDemandApp', err);
  }
}

(async function () {
  await init();
  process.exit(0);
})();
