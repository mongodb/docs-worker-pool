/** ******************************************************************
 *                  Monitor test                       *
 ******************************************************************* */

const FastlyJob = require('../../utils/fastlyJob').FastlyJobClass;

const payloadObj = {
  source: 'someSource',
  target: 'someTarget',
  email: 'email@gmail.com'
};

const goodDochuhJob = {
  payload: payloadObj
};

const doc = {
  _id: { $oid: '4db32eacdbd1ff5a7a24ff17' },
  url: 'http://www.mongodb.org/display/DOCS/Collections',
  name: 'collections'
};

describe('Fastly Job Test Class', () => {
  beforeAll(() => {});

  afterAll(() => {});

  beforeEach(() => {});

  afterEach(() => {});

  it('Fastly Job Class Test', async () => {
    const fastlyJob = new FastlyJob(goodDochuhJob);
    fastlyJob.connectAndUpsert = jest.fn().mockImplementation(() => {
      return { success: true };
    });
    expect(fastlyJob.connectAndUpsert([doc])).toEqual({ success: true });
  });

  it('FastlyJob test connect and upsert', async () => {
    const fastlyJob = new FastlyJob(goodDochuhJob);
    expect(fastlyJob.connectAndUpsert([doc])).toBeDefined();
  });
});
