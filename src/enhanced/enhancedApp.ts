import { handleJob } from './utils/job';
import { listenToJobQueue } from './utils/queue';

async function app() {
  console.log('starting application');
<<<<<<< HEAD
  const { jobId } = await listenToJobQueue();

  await handleJob(jobId);

  console.log('process completed');

  process.exit(0);
=======
  await listenToJobQueue();
>>>>>>> master
}

app();
