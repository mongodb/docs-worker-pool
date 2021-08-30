import { JobManager } from "./jobManager";
import {FastlyConnector} from "./services/cdn";
import {GitHubConnector} from "./services/repo";
import {HybridJobLogger, ConsoleLogger} from './services/logger';
import {ShellCommandExecutor} from './services/commandExecutor';
import { JobRepository } from "./repositories/jobRepository";
const config = require('config');
import { RepoEntitlementsRepository } from "./repositories/repoEntitlementsRepository";

import {MongoClient} from "mongodb"

// Setup the server with startServer()
let client = MongoClient()
let consoleLogger = new ConsoleLogger()
let commandExecutor = new ShellCommandExecutor(); 
let jobRepository = new JobRepository(null, config.collection, consoleLogger);
let hybridJobLogger = new HybridJobLogger(jobRepository);
let repoEntitlementRepository = new RepoEntitlementsRepository(null, config, consoleLogger);
let cdnConnector = new FastlyConnector(config, hybridJobLogger);
let repoConnector = new GitHubConnector(commandExecutor, hybridJobLogger);
let jobManager = new JobManager(jobRepository, repoEntitlementRepository, cdnConnector, repoConnector, hybridJobLogger);

jobManager
  .start()
  .then(() => {
    // Begin working!
    worker.work();
  })
  .catch(err => {
    console.log(`ERROR: ${err}`);
  });

// Handle SIGINT / SIGTERM from KUBERNETES
process.on('SIGINT', async () => {
  console.log('Received SIGINT');
  await jobManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM');
  await jobManager.stop();
  process.exit(0);
});
