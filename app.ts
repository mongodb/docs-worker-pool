import { JobManager } from "./src/jobManager";
import {IDBConnector} from "./src/services/db";
import {ICDNConnector} from "./src/services/cdn";
import {IRepoConnector} from "./src/services/repo";
import {ILogger} from './src/services/logger';
import {ICommandExecutor} from './src/services/commandExecutor';

// Setup the server with startServer()
let jobManager = new JobManager();
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
