import { listenToJobQueue } from './utils/queue';

async function app() {
  const job = await listenToJobQueue();
}

app();
