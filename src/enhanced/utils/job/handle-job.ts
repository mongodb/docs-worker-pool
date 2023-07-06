import { JobManager, JobHandlerFactory } from '../../../job/jobManager';
import { K8SCDNConnector } from '../../../services/cdn';
import { ParameterStoreConnector } from '../../../services/ssm';
import { GitHubConnector } from '../../../services/repo';
import { HybridJobLogger, ConsoleLogger } from '../../../services/logger';
import { GithubCommandExecutor, JobSpecificCommandExecutor } from '../../../services/commandExecutor';
import { JobRepository } from '../../../repositories/jobRepository';
import { RepoEntitlementsRepository } from '../../../repositories/repoEntitlementsRepository';
import c from 'config';
import * as mongodb from 'mongodb';
import { FileSystemServices } from '../../../services/fileServices';
import { JobValidator } from '../../../job/jobValidator';
import { RepoBranchesRepository } from '../../../repositories/repoBranchesRepository';
import { ISSOConnector, OktaConnector } from '../../../services/sso';
import { EnhancedJobHandlerFactory } from '../../job/enhancedJobHandlerFactory';

let consoleLogger: ConsoleLogger;
let fileSystemServices: FileSystemServices;
let jobCommandExecutor: JobSpecificCommandExecutor;
let githubCommandExecutor: GithubCommandExecutor;
let jobRepository: JobRepository;
let hybridJobLogger: HybridJobLogger;
let repoEntitlementRepository: RepoEntitlementsRepository;
let jobValidator: JobValidator;
let cdnConnector: K8SCDNConnector;
let repoConnector: GitHubConnector;
let jobHandlerFactory: JobHandlerFactory;
let jobManager: JobManager;
let repoBranchesRepo: RepoBranchesRepository;
let ssmConnector: ParameterStoreConnector;
let ssoConnector: ISSOConnector;

export async function handleJob(jobId: string, db: mongodb.Db) {
  consoleLogger = new ConsoleLogger();
  fileSystemServices = new FileSystemServices();
  jobCommandExecutor = new JobSpecificCommandExecutor();
  githubCommandExecutor = new GithubCommandExecutor();
  jobRepository = new JobRepository(db, c, consoleLogger);
  hybridJobLogger = new HybridJobLogger(jobRepository);
  ssmConnector = new ParameterStoreConnector();
  repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  repoBranchesRepo = new RepoBranchesRepository(db, c, consoleLogger);
  jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository, repoBranchesRepo);
  ssoConnector = new OktaConnector(c, consoleLogger);
  cdnConnector = new K8SCDNConnector(c, consoleLogger, ssmConnector, ssoConnector);
  repoConnector = new GitHubConnector(githubCommandExecutor, c, fileSystemServices, hybridJobLogger);
  jobHandlerFactory = new EnhancedJobHandlerFactory();

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
    repoBranchesRepo
  );

  try {
    await jobManager.startSpecificJob(jobId);
  } catch (err) {
    consoleLogger.info('enhancedApp', err);
  }
}
