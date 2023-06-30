import { ReceiveMessageCommandInput, SQS } from '@aws-sdk/client-sqs';
import config from 'config';
import { JobsQueuePayload } from '../../types/job-types';
import { isJobQueuePayload } from '../../types/utils/type-guards';
import { protectTask } from '../job';

/**
 * This function listens to the job queue until a message is received.
 * @returns {Promise<JobsQueuePayload>} the promise for the payload object after a message has been received
 */
export async function listenToJobQueue(): Promise<JobsQueuePayload> {
  const region = config.get<string>('aws_region');
  const queueUrl = config.get<string>('jobsQueueUrl');

  const client = new SQS({ region });

  console.log('[listenToJobQueue]: Polling jobsQueue');

  // We want to loop indefinitely so that we continue to poll the queue.
  while (true) {
    const receiveMessage: ReceiveMessageCommandInput = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 4,
    };

    const res = await client.receiveMessage(receiveMessage);

    if (!res.Messages || res.Messages.length === 0) continue;

    const message = res.Messages[0];

    // We have the message body, now we can delete it from the queue.
    try {
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle });
    } catch (e) {
      // We want to keep the task alive because we do not want to process multiple jobs.
      // This could lead to multiple tasks completing jobs, without new tasks being spun up.
      console.error(
        `[listenToJobQueue]: ERROR! Could not delete message. Preventing job from being processed, as this could lead this job being processed multiple times. Error Obj: ${JSON.stringify(
          e,
          null,
          4
        )}`
      );
      continue;
    }

    console.log('[listenToJobQueue]: Message successfully deleted from queue!');

    if (!message.Body) {
      console.error(
        `[listenToJobQueue]: ERROR! Received message from queue without body. Message ID is: ${message.MessageId}`
      );
      continue;
    }

    const payload = JSON.parse(message.Body);

    // Use type guard here to validate payload we have received from the queue.
    // This ensures that the `payload` object will be of type `JobQueuePayload` after the if statement.
    if (!isJobQueuePayload(payload)) {
      console.error(
        `[listenToJobQueue]: ERROR! Invalid payload data received from message ID: ${
          message.MessageId
        }. Payload received: ${JSON.stringify(payload)}`
      );
      continue;
    }

    console.log('[listenToJobQueue]: received valid message');

    // Before we delete the message from the queue, we want to protect the task.
    // This is because if protect the task after we delete, we could end up with a condition
    // where the task is unprotected, and it deletes a message. This means that if we happen
    // to do a deploy in this state, we will delete the message from the queue AND end the task,
    // preventing the job from completing while also losing the request in the process.
    // This means that the job request will never be processed.
    // NOTE: Intentionally not catching here, as this throw should be handled by the method listening to the queue.
    // We don't want to continue listening to the queue, as there is something wrong with the protect task mechanism.
    // We can let the task end, as it is unsafe to let an unprotected task process a job.
    await protectTask();

    console.log('[listenToJobQueue]: Deleting message...');

    // Great! we received a proper message from the queue. Return this object as we will no longer
    // want to poll for more messages.
    return payload;
  }
}
