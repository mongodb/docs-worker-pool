import { SQS } from '@aws-sdk/client-sqs';
import config from 'config';
import { JobsQueuePayload } from '../../types/job-types';
import { isJobQueuePayload } from '../../types/utils/type-guards';

/**
 * This function listens to the job queue until a message is received.
 * @returns {Promise<JobsQueuePayload>} the promise for the payload object after a message has been received
 */
export async function listenToJobQueue(): Promise<JobsQueuePayload> {
  const region = config.get<string>('aws_region');
  const queueUrl = config.get<string>('jobsQueueUrl');

  const client = new SQS({ region });

  // We want to loop indefinitely so that we continue to poll the queue.
  while (true) {
    const receiveMessage = { QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 2 };

    const res = await client.receiveMessage(receiveMessage);

    if (!res.Messages || res.Messages.length === 0) continue;

    const message = res.Messages[0];

    // We have the message body, now we can delete it from the queue.
    client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle });

    if (!message.Body) {
      console.error(`ERROR! Received message from queue without body. Message ID is: ${message.MessageId}`);
      continue;
    }

    const payload = JSON.parse(message.Body);

    // Use type guard here to validate payload we have received from the queue.
    // This ensures that the `payload` object will be of type `JobQueuePayload` after the if statement.
    if (!isJobQueuePayload(payload)) {
      console.error(
        `ERROR! Invalid payload data received from message ID: ${message.MessageId}. Payload received: ${JSON.stringify(
          payload
        )}`
      );
      continue;
    }

    // Great! we received a proper message from the queue. Return this object as we will no longer
    // want to poll for more messages.
    return payload;
  }
}
