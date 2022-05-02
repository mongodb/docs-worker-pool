import { K8SCDNConnector } from '../../../src/services/cdn';
import axios from 'axios';
import { mockDeep } from 'jest-mock-extended';
import { IConfig } from 'config';
import { ILogger } from './../../../src/services/logger';
import { ISSMConnector } from './../../../src/services/ssm';
import { ISSOConnector } from './../../../src/services/sso';

describe('K8SCDNConnector Tests', () => {
  let k8SCDNConnector: K8SCDNConnector;
  let logger;
  let ssmConnector;
  let config;
  let ssoConnector;
  let spyPost;

  beforeEach(() => {
    logger = mockDeep<ILogger>();
    ssmConnector = mockDeep<ISSMConnector>();
    config = mockDeep<IConfig>();
    ssoConnector = mockDeep<ISSOConnector>();
    k8SCDNConnector = new K8SCDNConnector(config, logger, ssmConnector, ssoConnector);
    spyPost = jest.spyOn(axios, 'post');
  });

  afterEach(() => {
    spyPost.mockClear();
  });

  test('Construct K8SCDNConnector', () => {
    expect(new K8SCDNConnector(config, logger, ssmConnector, ssoConnector)).toBeDefined();
  });

  describe('K8SCDNConnector purge tests', () => {
    test('K8SCDNConnector invalidates each object when 250 threshold is not met', async () => {
      const urlsArray = [
        'docs/realm/functions/js-feature-compatibility/index.html',
        'docs/realm/page-data/manage-apps/configure/environments/page-data.json',
        'docs/realm/page-data/values-and-secrets/define-and-manage-secrets/page-data.json',
      ];

      await k8SCDNConnector.purge('test_job_id_purge_all_urls', urlsArray, 'docs/realm');

      expect(spyPost).toHaveBeenCalled();
      expect(spyPost.mock.calls[0][1]).toStrictEqual({
        paths: [
          '/docs/realm/functions/js-feature-compatibility/index.html',
          '/docs/realm/page-data/manage-apps/configure/environments/page-data.json',
          '/docs/realm/page-data/values-and-secrets/define-and-manage-secrets/page-data.json',
        ],
      });
    });

    test('K8SCDNConnector performs wildcard invalidations when purging >= 250 objects', async () => {
      let urlArray = [];
      const differentUrlArray = [
        'docs/realm/functions/js-feature-compatibility/index.html',
        'docs/realm/page-data/manage-apps/configure/environments/page-data.json',
        'docs/realm/page-data/values-and-secrets/define-and-manage-secrets/page-data.json',
        'docs/realm/page-data/functions/call-a-function/page-data.json',
        'docs-qa/realm/users/enable-custom-user-data/index.html',
      ];

      while (urlArray.length < 250) {
        urlArray = urlArray.concat(differentUrlArray);
      }

      await k8SCDNConnector.purge('test_job_id_purge_wildcard_url', urlArray, 'docs/realm');

      expect(spyPost).toHaveBeenCalled();
      expect(spyPost.mock.calls[0][1]).toStrictEqual({ paths: ['/docs/realm/*'] });
    });
  });
});
