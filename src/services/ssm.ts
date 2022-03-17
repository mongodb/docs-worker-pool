import { SSM } from 'aws-sdk';

export interface ISSMConnector {
  getParameter(path: string, with_decrypt: boolean): Promise<any>;
  putParameter(
    name: string,
    value: string,
    with_decrypt: boolean,
    description: string,
    type: string,
    overwrite: boolean
  ): Promise<void>;
}

export class ParameterStoreConnector implements ISSMConnector {
  private _client: SSM;
  constructor() {
    this._client = new SSM({ region: 'us-east-2' });
  }
  async getParameter(name: string, with_decrypt: boolean): Promise<any> {
    return await this._client.getParameter({ Name: name, WithDecryption: with_decrypt }).promise();
  }
  async putParameter(
    name: string,
    value: string,
    with_decrypt: boolean,
    description: string,
    type: string,
    overwrite: boolean
  ): Promise<void> {
    await this._client
      .putParameter({ Name: name, Description: description, Value: value, Type: type, Overwrite: overwrite })
      .promise();
  }
}
