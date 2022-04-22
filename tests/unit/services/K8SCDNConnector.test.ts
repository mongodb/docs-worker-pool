import { K8SCDNConnector, axiosApi } from '../../../src/services/cdn';
import { mockDeep } from 'jest-mock-extended';
import MockAdapter from 'axios-mock-adapter';
import { IConfig } from 'config';
import { ILogger } from './../../../src/services/logger';
import { ISSMConnector } from './../../../src/services/ssm';
import { ISSOConnector } from './../../../src/services/sso';

describe('K8SCDNConnector Tests', () => {
  let k8SCDNConnector: K8SCDNConnector;
  let mock;
  let logger;
  let ssmConnecotr;
  let config;
  let ssoConnector;

  beforeEach(() => {
    mock = new MockAdapter(axiosApi);
    logger = mockDeep<ILogger>();
    ssmConnecotr = mockDeep<ISSMConnector>();
    config = mockDeep<IConfig>();
    ssoConnector = mockDeep<ISSOConnector>();

    k8SCDNConnector = new K8SCDNConnector(config, logger, ssmConnecotr, ssoConnector);
  });
  afterEach(() => {
    mock.reset();
  });

  test('Construct K8SCDNConnector', () => {
    expect(new K8SCDNConnector(config, logger, ssmConnecotr, ssoConnector)).toBeDefined();
  });

  describe('K8SCDNConnector purge tests', () => {
    beforeEach(() => {
      jest.setTimeout(30000);
    });
    test('K8SCDNConnector purge succeeds', async () => {
      const k8SCDNConnector = new K8SCDNConnector(
        mockDeep<IConfig>(),
        mockDeep<ILogger>(),
        mockDeep<ISSMConnector>(),
        mockDeep<ISSOConnector>()
      );
      await k8SCDNConnector.purge(
        'test_job_id',
        [
          '/docs/compass/upcoming/29107295-e47455e7b3c92fba2a11.js.map',
          '/docs/compass/upcoming/import-pipeline-from-text/index.html',
        ],
        'docs/compass'
      );
    });
    // afterAll(async () => {
    //   await new Promise(resolve => setTimeout(() => resolve(), 5000)); // avoid jest open handle error
    // });
    // expect(mock.history.put.length).toBe(1);
  });
});
