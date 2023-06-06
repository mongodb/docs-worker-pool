import { listenToJobQueue } from './utils/queue';

async function app() {
  console.log('starting application');
  await listenToJobQueue();
}

app();
