import { ILogger } from './logger';
import { SQS, SendMessageRequest } from '@aws-sdk/client-sqs';

import { IConfig } from 'config';
import { JobQueueMessage } from '../entities/queueMessage';

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
    this._client = new SQS({ region: config.get<string>('aws_region') });
  }

  async sendMessage(payload: JobQueueMessage, url: string, delay: number): Promise<void> {
    const sendMessageRequest: SendMessageRequest = {
      QueueUrl: url,
      MessageBody: JSON.stringify(payload),
      DelaySeconds: delay,
    };
    const result = await this._client.sendMessage(sendMessageRequest);
    this._logger.info('QueueConnector.sendMessage', `Result: ${result}`);
  }
}
