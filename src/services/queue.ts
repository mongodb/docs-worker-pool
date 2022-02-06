import { ILogger } from './logger';
import SQS, { MessageBodyAttributeMap, SendMessageRequest, SendMessageResult } from 'aws-sdk/clients/sqs';
import c from 'config';
import { JobQueueMessage } from '../entities/queueMessage';

export interface IQueueConnector {
  sendMessage(payload: JobQueueMessage, url: string, delay: number): Promise<void>;
}

export class SQSConnector implements IQueueConnector {
  private _logger: ILogger;
  private _client: SQS;
  constructor(logger: ILogger) {
    this._logger = logger;
    this._client = new SQS({ region: c.get<string>('aws_region') });
  }

  async sendMessage(payload: JobQueueMessage, url: string, delay: number): Promise<void> {
    const messageAttributes: MessageBodyAttributeMap = {
      delay: {
        DataType: 'Number',
        StringValue: delay.toString(),
      },
    };
    const sendMessageRequest: SendMessageRequest = {
      QueueUrl: url,
      MessageBody: JSON.stringify(payload),
      MessageAttributes: messageAttributes,
    };
    const result = await this._client.sendMessage(sendMessageRequest).promise();
    console.log(result); // Remove once things are fine
  }
}
