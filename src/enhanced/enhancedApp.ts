import { listenToJobQueue } from './utils/queue/listen-to-job-queue';

async function app() {
  const job = await listenToJobQueue();
}

app();
