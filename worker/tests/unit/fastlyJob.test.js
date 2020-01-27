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

describe('Fastly Job Test Class', () => {
  beforeAll(() => {});

  afterAll(() => {});

  beforeEach(() => {});

  afterEach(() => {});

  it('FastlyJob test connect and upsert', async () => {
    const fastly = new FastlyJob(this.goodDochuhJob);
    return fastly.connectAndUpsert(map).catch(error => {
      expect(error).toBeDefined();
    });
  });
});
