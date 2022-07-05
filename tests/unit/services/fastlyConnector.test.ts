import { FastlyConnector, axiosApi } from '../../../src/services/cdn';
import { mockDeep } from 'jest-mock-extended';
import { IJobRepoLogger } from '../../../src/services/logger';
import MockAdapter from 'axios-mock-adapter';

// describe('FastlyConnector purge Tests', () => {
//     beforeEach(() => {
//         jest.setTimeout(30000);
//     });
//     test('FastlyConnector purge succeeds', async() => {
//         let fastlyConnector = new FastlyConnector(mockDeep<IJobRepoLogger>());
//         await fastlyConnector.purge("test_job_id", ["https://docs-mongodborg-staging.corp.mongodb.com/compass/master/editions/index.html"]);
//     })
//     afterAll(async () => {
//         await new Promise(resolve => setTimeout(() => resolve(), 5000)); // avoid jest open handle error
//     });
// })

describe('FastlyConnector Tests', () => {
  let fastlyConnector: FastlyConnector;
  let logger: IJobRepoLogger;
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(axiosApi);
    logger = mockDeep<IJobRepoLogger>();
    fastlyConnector = new FastlyConnector(logger);
  });
  afterEach(() => {
    mock.reset();
  });

  test('Construct FastlyConnector', () => {
    expect(new FastlyConnector(logger)).toBeDefined();
  });

  describe('FastlyConnector Warm Tests', () => {
    test('FastlyConnector Warm with non 200 response returns false', async () => {
      mock.onGet(`test`).reply(404, {});
      await expect(fastlyConnector.warm('test')).rejects.toEqual(new Error('Request failed with status code 404'));
      expect(mock.history.get.length).toBe(1);
    });
  });

  describe('FastlyConnector upsertEdgeDictionaryItem Tests', () => {
    test('FastlyConnector upsertEdgeDictionaryItem with valid value works fine', async () => {
      mock
        .onPut(
          `https://api.fastly.com/service/id/dictionary/dictId/item/edgeDictKey`,
          { item_value: 'edgeDictValue' },
          {
            'Fastly-Key': 'key',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Fastly-Debug': 1,
          }
        )
        .reply(200, {});
      await fastlyConnector.upsertEdgeDictionaryItem({ key: 'edgeDictKey', value: 'edgeDictValue' }, 'dictId', {
        id: 'id',
        token: 'key',
      });
      expect(mock.history.put.length).toBe(1);
    });
  });
});
