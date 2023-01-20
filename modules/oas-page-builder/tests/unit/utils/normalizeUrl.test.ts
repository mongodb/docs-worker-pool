import { normalizeUrl } from '../../../src/utils/normalizeUrl';

describe('normalizeUrl', () => {
  it('removes extra consecutive forward slashes', () => {
    const httpsUrl = 'https://mongodbcom-cdn.website.staging.corp.mongodb.com//docs-qa/atlas/app-services';
    let result = normalizeUrl(httpsUrl);
    expect(result).toBe('https://mongodbcom-cdn.website.staging.corp.mongodb.com/docs-qa/atlas/app-services');

    // Should work regardless of protocol
    const httpUrl = 'http://mongodbcom-cdn.website.staging.corp.mongodb.com//docs-qa/atlas/app-services';
    result = normalizeUrl(httpUrl);
    expect(result).toBe('http://mongodbcom-cdn.website.staging.corp.mongodb.com/docs-qa/atlas/app-services');
  });
});
