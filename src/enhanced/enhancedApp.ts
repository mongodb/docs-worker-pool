import { handleJob } from './utils/job';
import { listenToJobQueue } from './utils/queue';
import mongodb from 'mongodb';
import c from 'config';

let client: mongodb.MongoClient;

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

  client.close();
  process.exit(0);
}

app();
