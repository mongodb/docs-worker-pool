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
let client: mongodb.MongoClient;
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
  fileSystemServices = new FileSystemServices();
  jobCommandExecutor = new JobSpecificCommandExecutor();
  githubCommandExecutor = new GithubCommandExecutor();
  jobRepository = new JobRepository(db, c, consoleLogger);
  hybridJobLogger = new HybridJobLogger(jobRepository);
  repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  repoBranchesRepo = new RepoBranchesRepository(db, c, consoleLogger);
  jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepo);
  cdnConnector = new FastlyConnector(consoleLogger);
  repoConnector = new GitHubConnector(githubCommandExecutor, c, fileSystemServices, hybridJobLogger);
  jobHandlerFactory = new JobHandlerFactory();
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
  jobManager.start().catch((err) => {
    consoleLogger.error('App', `ERROR: ${err}`);
  });
}
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM');
  await jobManager.stop();
  if (client) {
    client.close();
    consoleLogger.info('App', '\nServer has closed mongo client connection');
  }
  process.exit(0);
});

(async function () {
  await init();
})();
