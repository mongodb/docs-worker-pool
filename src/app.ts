import { JobManager, JobHandlerFactory } from "./job/jobManager";
import { FastlyConnector } from "./services/cdn";
import { GitHubConnector } from "./services/repo";
import { HybridJobLogger, ConsoleLogger } from './services/logger';
import { GithubCommandExecutor, JobSpecificCommandExecutor } from './services/commandExecutor';
import { JobRepository } from "./repositories/jobRepository";
import { RepoEntitlementsRepository } from "./repositories/repoEntitlementsRepository";
import c from "config";
import mongodb from "mongodb";
import { FileSystemServices } from "./services/fileServices";
import { JobValidator } from "./job/jobValidator";

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
let jobHandletFactory: JobHandlerFactory;
let jobManager: JobManager;

async function init(): Promise<void> {
  const url = `mongodb+srv://${c.get("dbUsername")}:${c.get("dbPassword")}@cluster0-ylwlz.mongodb.net/admin?retryWrites=true`;
  let client = new mongodb.MongoClient(url);
  await client.connect();
  db = client.db(c.get("dbName"));
  consoleLogger = new ConsoleLogger();
  fileSystemServices = new FileSystemServices();
  jobCommandExecutor = new JobSpecificCommandExecutor();
  githubCommandExecutor = new GithubCommandExecutor();
  jobRepository = new JobRepository(db, c, consoleLogger);
  hybridJobLogger = new HybridJobLogger(jobRepository);
  repoEntitlementRepository = new RepoEntitlementsRepository(db, c.get("entitlementCollection"), consoleLogger);
  jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository);
  cdnConnector = new FastlyConnector(c, hybridJobLogger);
  repoConnector = new GitHubConnector(githubCommandExecutor, c, fileSystemServices, hybridJobLogger);
  jobHandletFactory = new JobHandlerFactory();
  jobManager = new JobManager(c, jobValidator, jobHandletFactory, jobCommandExecutor, jobRepository, cdnConnector, repoConnector, fileSystemServices, hybridJobLogger);
  jobManager
    .start()
    .catch(err => {
      console.log(`ERROR: ${err}`);
    });

}
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM');
  await jobManager.stop();
  if (client) {
    client.close();
    consoleLogger.info("App", '\nServer has closed mongo client connection');
  }
  process.exit(0);
});

(async function() {
  await init();
})();
