import { handleJob, protectTask } from './utils/job';
import { listenToJobQueue } from './utils/queue';
import mongodb from 'mongodb';
import c from 'config';

let client: mongodb.MongoClient;

async function cleanupJob() {
  try {
    console.log('Closing MongoDB client connection...');
    await client.close();

    console.log('Successfully closed MongoDB client connection!');
  } catch (e) {
    console.log('ERROR! Unsuccessfully closed MongoDB client connection', e);
  }

  process.exit(0);
}

async function app() {
  console.log('starting application');

  try {
    const { jobId } = await listenToJobQueue();

    const atlasURL = `mongodb+srv://${c.get('dbUsername')}:${c.get('dbPassword')}@${c.get(
      'dbHost'
    )}/?retryWrites=true&w=majority`;

    client = new mongodb.MongoClient(atlasURL);
    await client.connect();
    const db = client.db(c.get('dbName'));

    await handleJob(jobId, db);
    console.log('process completed');
  } catch (e) {
    console.error('ERROR! Job failed', e);
  }

  await cleanupJob();
}

app();
