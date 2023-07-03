import { handleJob } from './utils/job';
import { listenToJobQueue } from './utils/queue';
import mongodb, { MongoClient } from 'mongodb';
import c from 'config';

let client: MongoClient | undefined;

async function connectToDb(): Promise<mongodb.Db> {
  const atlasURL = `mongodb+srv://${c.get('dbUsername')}:${c.get('dbPassword')}@${c.get(
    'dbHost'
  )}/?retryWrites=true&w=majority`;

  console.log('[connectToDb]: Instantiating MongoDB client object');
  client = new MongoClient(atlasURL);
  console.log('[connectToDb]: Connecting to client');
  await client.connect();
  return client.db(c.get('dbName'));
}

async function cleanupJob(): Promise<never> {
  try {
    console.log('[cleanupJob]: Closing MongoDB client connection...');
    await client?.close();

    console.log('[cleanupJob]: Successfully closed MongoDB client connection!');
  } catch (e) {
    console.log('[cleanupJob]: ERROR! Unsuccessfully closed MongoDB client connection', e);
    process.exitCode = 1;
  }

  process.exit();
}

/**
 * Added this function as it appears that the finally block would be executed after
 * the first promise resolves within the app function. Broke this out so that we only call the clean up after we handle the job.
 * the `finally` block is always called after the try, even if an exception is thrown. If an exception is thrown, the cleanUp job is called,
 * and the exception is then thrown after.
 */
async function handleJobAndCleanUp(jobId: string, db: mongodb.Db) {
  try {
    await handleJob(jobId, db);
  } finally {
    await cleanupJob();
  }
}
async function app(): Promise<void> {
  console.log('[app]: starting application');

  try {
    const { jobId } = await listenToJobQueue();
    const db = await connectToDb();

    await handleJobAndCleanUp(jobId, db);

    console.log('[app]: process completed');
  } catch (e) {
    console.error('[app]: ERROR! Job initialization failed', e);
    process.exitCode = 1;
  }
}

app();

process.on('SIGTERM', async () => {
  await cleanupJob();
});
