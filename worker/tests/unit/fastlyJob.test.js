/** ******************************************************************
 *                  Monitor test                       *
 ******************************************************************* */

const FastlyJob = require('../../utils/fastlyJob').FastlyJobClass;

const payloadObj = {
  source: 'someSource',
  target: 'someTarget',
};

const goodDochuhJob = {
  payload: payloadObj
};

const doc = {
  _id: { $oid: '4db32eacdbd1ff5a7a24ff17' },
  url: 'http://www.mongodb.org/display/DOCS/Collections',
  name: 'collections'
};

const map = {
  'source': 'source',
  'target': 'target'
};

// test purge urls
const urlsExistInFastly = [
  'https://docs.opsmanager.mongodb.com/current/installation/',
  'https://docs.opsmanager.mongodb.com/current/core/requirements/',
  'https://docs.mongodb.com/drivers/cxx/'
];

const urlsNoExist = [
  'https://docs_DOES_NOT_EXIST.opsmanager.mongodb.com/index.txt',
];

describe('Fastly Job Test Class', () => {

  let fastly;

  beforeAll(() => {
    fastly = new FastlyJob(this.goodDochuhJob);
  });

  afterAll(() => {});

  beforeEach(() => {});

  afterEach(() => {});

  it('FastlyJob test connect and upsert', async () => {
    return fastly.connectAndUpsert(map).catch(error => {
      expect(error).toBeDefined();
    });
  });

  it('FastlyJob test purge', async () => {
    return fastly.purgeCache(urlsExistInFastly).then(output => {
      expect(output.status).toEqual('success');
      expect(output).toHaveProperty('fastlyMessages');
    });
  });

  it('FastlyJob test purge for url service that does not exist', async () => {
    return fastly.purgeCache(urlsNoExist).then(output => {
      expect(output.status).toEqual('success');
      expect(output).toHaveProperty('fastlyMessages');
      expect(output.fastlyMessages[0].status).toEqual('failure');
    });
  });

});
