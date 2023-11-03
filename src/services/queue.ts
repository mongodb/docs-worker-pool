import { ILogger } from './logger';
import { SQS, SendMessageRequest } from '@aws-sdk/client-sqs';
import AWSXRay from 'aws-xray-sdk-core';
import { IConfig } from 'config';
import { JobQueueMessage } from '../entities/queueMessage';

const client = AWSXRay.captureAWSv3Client(new SQS({ region: 'us-east-2' }));
export interface IQueueConnector {
  sendMessage(payload: JobQueueMessage, url: string, delay: number): Promise<void>;
}

export class SQSConnector implements IQueueConnector {
  private _logger: ILogger;
  private _client: SQS;
  private _config: IConfig;
  constructor(logger: ILogger, config: IConfig) {
    this._logger = logger;
    this._config = config;
    this._client = client;
  }

  async sendMessage(payload: JobQueueMessage, url: string, delay: number): Promise<void> {
    const sendMessageRequest: SendMessageRequest = {
      QueueUrl: url,
      MessageBody: JSON.stringify(payload),
      DelaySeconds: delay,
    };
    const result = await this._client.sendMessage(sendMessageRequest);
    this._logger.info('QueueConnector.sendMessage', `Result: ${JSON.stringify(result)}`);
  }
}
