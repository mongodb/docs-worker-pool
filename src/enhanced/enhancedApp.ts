import { listenToJobQueue } from './utils/queue';

async function app() {
  await listenToJobQueue();
}

app();
