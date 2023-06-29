import { handleJob } from './utils/job';
import { listenToJobQueue } from './utils/queue';
import mongodb from 'mongodb';
import c from 'config';

let client: mongodb.MongoClient | undefined;

async function connectToDb(): Promise<mongodb.Db> {
  const atlasURL = `mongodb+srv://${c.get('dbUsername')}:${c.get('dbPassword')}@${c.get(
    'dbHost'
  )}/?retryWrites=true&w=majority`;

  client = new mongodb.MongoClient(atlasURL);
  await client.connect();
  return client.db(c.get('dbName'));
}

async function cleanupJob(): Promise<never> {
  try {
    console.log('Closing MongoDB client connection...');
    await client?.close();

    console.log('Successfully closed MongoDB client connection!');
  } catch (e) {
    console.log('ERROR! Unsuccessfully closed MongoDB client connection', e);
    process.exitCode = 1;
  }

  process.exit();
}

async function app(): Promise<void> {
  console.log('starting application');

  try {
    const { jobId } = await listenToJobQueue();
    const db = await connectToDb();

    await handleJob(jobId, db);

    console.log('process completed');
  } catch (e) {
    console.error('ERROR! Job initialization failed', e);
    process.exitCode = 1;
  }

  await cleanupJob();
}

app();
