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
      expect(env.EnvironmentClass.getAtlasPassword()).toEqual('passwordTest');
      expect(env.EnvironmentClass.getAtlasUsername()).toEqual('usernameTest');
      expect(env.EnvironmentClass.getDB()).toEqual('pool_test');
      expect(env.EnvironmentClass.getDochubMap()).toEqual('dochubMap');
      expect(env.EnvironmentClass.getFastlyServiceId()).toEqual('testId');
      expect(env.EnvironmentClass.getFastlyToken()).toBeUndefined();
      expect(env.EnvironmentClass.getXlarge()).toEqual(false);

  });
});
