/** ******************************************************************
 *                  Sample Class for Testing                       *
 ******************************************************************* */

const env = require('../../utils/environment');

describe('Test Class', () => {
  beforeAll(() => {});

  afterAll(() => {});

  beforeEach(() => {});

  afterEach(() => {});

  it('test env defaults', async () => {
    expect(env.EnvironmentClass.getAtlasPassword()).toBeDefined();
    expect(env.EnvironmentClass.getAtlasUsername()).toBeDefined();
    expect(env.EnvironmentClass.getDB()).toBeDefined();
    expect(env.EnvironmentClass.getDochubMap()).toBeDefined();
    expect(env.EnvironmentClass.getFastlyServiceId()).toBeDefined();
    expect(env.EnvironmentClass.getFastlyToken()).toBeDefined();
    expect(env.EnvironmentClass.getXlarge()).toBeDefined();

  });
});
