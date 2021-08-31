import { JobManager } from "./jobManager";
import {FastlyConnector} from "./services/cdn";
import {GitHubConnector} from "./services/repo";
import {HybridJobLogger, ConsoleLogger} from './services/logger';
import {GithubCommandExecutor, JobSpecificCommandExecutor, ShellCommandExecutor} from './services/commandExecutor';
import { JobRepository } from "./repositories/jobRepository";
import { RepoEntitlementsRepository } from "./repositories/repoEntitlementsRepository";
import c from "config";
const { MongoClient } = require('mongodb');
import { FileSystemServices } from "./services/fileServices";
import { JobValidator } from "./job/jobValidator";
import { JobFactory } from "./job/jobFactory";

const url = `mongodb+srv://${c.get("dbUsername")}:${c.get("dbPassword")}@cluster0-ylwlz.mongodb.net/admin?retryWrites=true`;
let client = new MongoClient(url, { useNewUrlParser: true });


let db = client.connect()
let consoleLogger = new ConsoleLogger();
let fileSystemServices = new FileSystemServices();
let jobCommandExecutor = new JobSpecificCommandExecutor();
let githubCommandExecutor = new GithubCommandExecutor();
let jobRepository = new JobRepository(db, c.get("jobQueueCollection"), consoleLogger);

let hybridJobLogger = new HybridJobLogger(jobRepository);
let repoEntitlementRepository = new RepoEntitlementsRepository(db, c.get("entitlementCollection"), consoleLogger);
let jobValidator = new JobValidator(fileSystemServices, repoEntitlementRepository);
let cdnConnector = new FastlyConnector(c, hybridJobLogger);
let repoConnector = new GitHubConnector(githubCommandExecutor, c, fileSystemServices, hybridJobLogger);
let jobFactory = new JobFactory();
let jobManager = new JobManager(c, jobValidator, jobFactory,jobCommandExecutor, jobRepository, repoEntitlementRepository, cdnConnector, repoConnector, fileSystemServices, hybridJobLogger);

jobManager
  .start()
  .catch(err => {
    console.log(`ERROR: ${err}`);
  });

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM');
  await jobManager.stop();
  if (client) {
    client.close();
    consoleLogger.info("App", '\nServer has closed mongo client connection');
  }
  process.exit(0);
});

