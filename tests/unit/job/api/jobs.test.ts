import { extractUrlFromMessage } from '../../../../api/controllers/v1/jobs';
import { Job } from '../../../../src/entities/job';
import validURLFormatDoc from '../../../data/fullDoc';
import invalidURLFormatDoc from '../../../data/fullDoc';

describe('JobValidator Tests', () => {
  test('valid urls doc returns list of valid urls', () => {
    const job = Object.assign({}, validURLFormatDoc);
    const urls = extractUrlFromMessage(job);
    expect(urls[urls.length - 1]).toEqual('https://docs.mongodb.com/drivers/java/sync/upcoming');
  });
  test('invalid urls doc returns list of valid urls', () => {
    const job = Object.assign({}, invalidURLFormatDoc);
    const urls = extractUrlFromMessage(job);
    expect(urls[urls.length - 1]).toEqual('https://docs.mongodb.com/drivers/java/sync/upcoming');
  });
});
