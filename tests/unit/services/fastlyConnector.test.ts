import { FastlyConnector, axiosApi } from '../../../services/cdn';
import { IConfig } from "config";
import { mockDeep } from "jest-mock-extended";
import { IJobRepoLogger } from "../../../services/logger";
import { TestDataProvider } from '../../data/data';
import MockAdapter from 'axios-mock-adapter';

describe('FastlyConnector Tests', () => {
    let fastlyConnector: FastlyConnector;
    let config: IConfig;
    let logger: IJobRepoLogger;
    let mock;

    beforeEach(() => {
        config = mockDeep<IConfig>();
        mock = new MockAdapter(axiosApi);
        logger = mockDeep<IJobRepoLogger>();
        config.get.calledWith('fastlyToken').mockReturnValue('FastlyToken');
        config.get.calledWith('fastlyServiceId').mockReturnValue('FastlyServiceId');
        config.get.calledWith('fastlyToken').mockReturnValue('FastlyToken');
        fastlyConnector = new FastlyConnector(config, logger);
    })
    afterEach(() => {
        mock.reset();
    })

    test('Construct FastlyConnector', () => {
        expect(new FastlyConnector(config, logger)).toBeDefined();
    })

    describe('FastlyConnector purge Tests', () => {
        test('FastlyConnector purge succeeds', async() => {
            const testData = TestDataProvider.getPurgeAllUrlWithSurrogateKeys();
            testData.urls.forEach(url => {
                mock.onHead(url,{}, {
                    'Fastly-Key': config.get('fastlyToken'),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Fastly-Debug': 1
                }).reply(200, {}, {"surrogate-key": testData.url_to_sk[url]});
                  mock.onPost(`https://api.fastly.com/service/${config.get('fastlyServiceId')}/purge/${testData.url_to_sk[url]}`, {}, {
                      'Surrogate-Key': testData.url_to_sk[url],
                      'Fastly-Key': config.get('fastlyToken'),
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      'Fastly-Debug': 1
                  }).reply(200, {});
                  mock.onGet(url).reply(200, {});
            });
            await fastlyConnector.purge("test_job_id", testData.urls);
            expect(mock.history.head.length).toBe(4);
            expect(mock.history.post.length).toBe(4);
            expect(mock.history.get.length).toBe(4);
        })

        test('FastlyConnector purge continues even one surrogate retrieval succeeds', async() => {
            const testData = TestDataProvider.getPurgeAllUrlWithSurrogateKeys();
            testData.urls.forEach(url => {
                let retCode = 200;
                if (url == 'url1') {
                    retCode = 401;
                }
                mock.onHead(url,{}, {
                    'Fastly-Key': config.get('fastlyToken'),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Fastly-Debug': 1,
                }).reply(retCode, {}, {"surrogate-key": testData.url_to_sk[url]});
                  mock.onPost(`https://api.fastly.com/service/${config.get('fastlyServiceId')}/purge/${testData.url_to_sk[url]}`, ).reply(retCode, {});
                  mock.onGet(url).reply(retCode, {});
            });
            await fastlyConnector.purge("test_job_id", testData.urls);
            expect(mock.history.head.length).toBe(4);
            expect(mock.history.post.length).toBe(3);
            expect(mock.history.get.length).toBe(3);
        })

        test('FastlyConnector purge continues even one purge retrieval succeeds', async() => {
            const testData = TestDataProvider.getPurgeAllUrlWithSurrogateKeys();
            testData.urls.forEach(url => {
                let retCode = 200;
                mock.onHead(url,{}, {
                    'Fastly-Key': config.get('fastlyToken'),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Fastly-Debug': 1,
                }).reply(retCode, {}, {"surrogate-key": testData.url_to_sk[url]});
                if (url == 'url1') {
                    retCode = 401;
                }
                mock.onPost(`https://api.fastly.com/service/${config.get('fastlyServiceId')}/purge/${testData.url_to_sk[url]}`, ).reply(retCode, {});
                mock.onGet(url).reply(retCode, {});
            });
            await fastlyConnector.purge("test_job_id", testData.urls);
            expect(mock.history.head.length).toBe(4);
            expect(mock.history.post.length).toBe(4);
            expect(mock.history.get.length).toBe(3);
        })
    })

    describe('FastlyConnector purge  All Tests', () => {
        test('FastlyConnector purge all succeeds', async() => {
            mock.onPost(`https://api.fastly.com/service/${config.get('fastlyServiceId')}/purge_all`, {}, {
                'Fastly-Key': config.get('fastlyToken'),
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Fastly-Debug': 1
            }).reply(200, {});
            await fastlyConnector.purgeAll("test_job_id");
            expect(mock.history.post.length).toBe(1);
        })

        test('FastlyConnector purge all fails throws exception', async() => {
            mock.onPost(`https://api.fastly.com/service/${config.get('fastlyServiceId')}/purge_all`, {}, {
                'Fastly-Key': config.get('fastlyToken'),
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Fastly-Debug': 1
            }).reply(401, {});
            await expect(fastlyConnector.purgeAll("test_job_id")).rejects.toThrow("Request failed with status code 401");
            expect(mock.history.post.length).toBe(1);
        })
    })

    describe('FastlyConnector Warm Tests', () => {
        test('FastlyConnector Warm with non 200 response returns false', async() => {
            mock.onGet(`test`).reply(202, {});
            await expect(fastlyConnector.warm("test_job", "test")).resolves.toBe(false);
            expect(mock.history.get.length).toBe(1);
        })
    })
})