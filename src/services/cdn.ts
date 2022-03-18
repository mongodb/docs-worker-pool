import axios from 'axios';
import { IConfig } from 'config';
import { CDNCreds } from '../entities/creds';
import { ILogger } from './logger';
import { ISSMConnector } from './ssm';
import { ISSOConnector } from './sso';
export const axiosApi = axios.create();

export interface ICDNConnector {
  purge(jobId: string, urls: Array<string>): Promise<void>;
  purgeAll(creds: CDNCreds): Promise<any>;
  warm(jobId: string, url: string): Promise<any>;
  upsertEdgeDictionaryItem(keyValue: any, id: string, creds: CDNCreds): Promise<void>;
}

export class FastlyConnector implements ICDNConnector {
  private _logger: ILogger;
  constructor(logger: ILogger) {
    this._logger = logger;
  }

  getHeaders(creds: CDNCreds): any {
    return {
      'Fastly-Key': creds.token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Fastly-Debug': 1,
    };
  }

  async purgeAll(creds: CDNCreds): Promise<any> {
    return await axiosApi.post(
      `https://api.fastly.com/service/${creds.id}/purge_all`,
      {},
      { headers: this.getHeaders(creds) }
    );
  }

  async warm(url: string): Promise<any> {
    return await axiosApi.get(url);
  }

  async purge(jobId: string, urls: Array<string>): Promise<void> {
    const purgeUrlPromises = urls.map((url) => this.purgeURL(url));
    await Promise.all(
      purgeUrlPromises.map((p) =>
        p.catch((e) => {
          urls.splice(urls.indexOf(e.url), 1);
          return '';
        })
      )
    );
    this._logger.info(jobId, `Total urls purged ${urls.length}`);
    // GET request the URLs to warm cache for our users
    const warmCachePromises = urls.map((url) => this.warm(url));
    await Promise.all(warmCachePromises);
  }

  private async purgeURL(url: string): Promise<any> {
    return await axiosApi({
      method: 'PURGE',
      url: url,
    });
  }

  async upsertEdgeDictionaryItem(keyValue: any, id: string, creds: CDNCreds): Promise<any> {
    return await axiosApi.put(
      `https://api.fastly.com/service/${creds.id}/dictionary/${id}/item/${keyValue.key}`,
      {
        item_value: keyValue.value,
      },
      { headers: this.getHeaders(creds) }
    );
  }
}

export class K8SCDNConnector implements ICDNConnector {
  private _logger: ILogger;
  private _ssmConnector: ISSMConnector;
  private _config: IConfig;
  private _ssoConnector: ISSOConnector;

  constructor(config: IConfig, logger: ILogger, ssmConnecotr: ISSMConnector, ssoConnector: ISSOConnector) {
    this._logger = logger;
    this._ssmConnector = ssmConnecotr;
    this._config = config;
    this._ssoConnector = ssoConnector;
  }

  async generateAndSetToken(): Promise<any> {
    const res = await this._ssoConnector.retrieveOAuthToken();
    if (res?.data?.access_token) {
      await this._ssmConnector.putParameter(
        `/env/${this._config.get<string>('env')}/${this._config.get<string>('oauthTokenPath')}`,
        res.data['access_token'],
        true,
        'OAuth Token',
        'SecureString',
        true
      );
      return res.data['access_token'];
    }
    return null;
  }

  async getToken(): Promise<any> {
    let token = await this._ssmConnector.getParameter(
      `/env/${this._config.get<string>('env')}/${this._config.get<string>('oauthTokenPath')}`,
      true
    );
    if (!token) {
      token = await this.generateAndSetToken();
    } else {
      token = token['Parameter']['Value'];
      const decodedValue = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('ascii'));
      if (decodedValue.exp < new Date().getTime() / 1000) {
        token = await this.generateAndSetToken();
      }
    }
    return token;
  }

  async getHeaders(): Promise<any> {
    const data = await this.getToken();
    return {
      Authorization: `Bearer ${data}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async purge(jobId: string, urls: string[]): Promise<void> {
    console.log(urls);
    console.log('K8SCDNConnector purge');
    const url = this._config.get<string>('cdnInvalidatorServiceURL');
    console.log(url);
    const headers = await this.getHeaders();
    console.log(headers);
    const res = await axios.post(url, { paths: urls }, { headers: headers });
    console.log(res?.data);
    this._logger.info(jobId, `Total urls purged ${urls.length}`);
  }

  purgeAll(creds: CDNCreds): Promise<any> {
    throw new Error('Method not implemented.');
  }

  warm(jobId: string, url: string): Promise<any> {
    throw new Error('Method not implemented.');
  }

  upsertEdgeDictionaryItem(keyValue: any, id: string, creds: CDNCreds): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
