import TestableArrayWrapper from '../../../src/job/ITestableTypeWrapper';

describe('JobHandlerFactory Tests', () => {
  beforeEach(() => {

  })

  test('Construct Job Factory', () => {
    const testableWrapper = new TestableArrayWrapper();
    expect(testableWrapper).toBeDefined();
  })

  test('length check returns valid length given an valid input', () => {
    const testableWrapper = new TestableArrayWrapper();
    expect(testableWrapper.length(["d","eee", "dddd"]).valueOf()).toEqual(3);
  })

  test('length check returns 0 given an invalid input', () => {
    const testableWrapper = new TestableArrayWrapper();
    expect(testableWrapper.length(null).valueOf()).toEqual(0);
  })

})