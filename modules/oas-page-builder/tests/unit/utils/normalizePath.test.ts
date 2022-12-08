import { normalizePath } from '../../../src/utils/normalizePath';

describe('normalizePath', () => {
  it('removes extra consecutive forward slashes', () => {
    const testString = '/beep///boop//bop';
    const result = normalizePath(testString);
    expect(result).toBe('/beep/boop/bop');
  });
});
