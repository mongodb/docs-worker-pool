import { SQS } from '@aws-sdk/client-sqs';
import config from 'config';
import { JobsQueuePayload, isJobQueuePayload } from './types';

/**
 * This function listens to the job queue until a message is received.
 * @returns {Promise<JobsQueuePayload>} the promise for the payload object after a message has been received
 */
export async function listenToJobQueue(): Promise<JobsQueuePayload> {
  const region = config.get<string>('aws_region');
  const queueUrl = config.get<string>('jobsQueueUrl');

  const client = new SQS({ region });

  while (true) {
    const receiveMessage = { QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 2 };
    const res = await client.receiveMessage(receiveMessage);

    if (res.Messages && res.Messages.length > 0) {
      const message = res.Messages[0];

      if (!message.Body) {
        console.error(`ERROR! Received message from queue without body. Message ID is: ${message.MessageId}`);
        continue;
      }

      const payload = JSON.parse(message.Body);

      if (!isJobQueuePayload(payload)) {
        console.error(
          `ERROR! Invalid payload data received from message ID: ${
            message.MessageId
          }. Payload received: ${JSON.stringify(payload)}`
        );
        continue;
      }

      // Great! we received a proper message from the queue. Return this object as we will no longer
      // want to poll for more messages.
      return payload;
    }
  }
}
