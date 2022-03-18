import { IConfig } from 'config';
import axios from 'axios';
import { ILogger } from './logger';

export const axiosApi = axios.create();

export interface ISSOConnector {
  retrieveOAuthToken(): Promise<any>;
}

export class OktaConnector implements ISSOConnector {
  private _logger: ILogger;
  private _config: IConfig;
  constructor(config: IConfig, logger: ILogger) {
    this._logger = logger;
    this._config = config;
  }

  getAuthorizationHeader(): string {
    return Buffer.from(
      `${this._config.get<string>('cdnClientID')}:${this._config.get<string>('cdnClientSecret')}`,
      'utf-8'
    ).toString('base64');
  }

  getHeaders(): any {
    return {
      authorization: `Basic ${this.getAuthorizationHeader()}`,
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'cache-control': 'no-cache',
    };
  }

  async retrieveOAuthToken(): Promise<any> {
    return await axiosApi.post(
      `${this._config.get<string>('oauthTokenURL')}?grant_type=${this._config.get<string>(
        'grantType'
      )}&scope=${this._config.get<string>('cdnInvalidationOauthScope')}`,
      {},
      { headers: this.getHeaders() }
    );
  }
}
