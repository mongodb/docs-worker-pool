import { SQS } from '@aws-sdk/client-sqs';
import config from 'config';

let client: SQS;

export async function listenToJobQueue(): Promise<unknown> {
  const region = config.get<string>('aws_region');
  const queueUrl = config.get<string>('jobsQueueUrl');

  if (!client) {
    client = new SQS({ region });
  }

  while (true) {
    const receiveMessage = { QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 2 };
    const res = await client.receiveMessage(receiveMessage);

    if (res.Messages && res.Messages.length > 0) {
      const message = res.Messages[0];

      if (!message.Body) {
        console.error(`ERROR! Received message from queue without body. Message ID is: ${message.MessageId}`);
        continue;
      }

      const body = JSON.parse(message.Body);
    }
  }
}
