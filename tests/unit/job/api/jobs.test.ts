import * as mongodb from 'mongodb';
import { SnootyBuildComplete } from '../../../../api/controllers/v1/jobs';
import validURLFormatDoc from '../../../data/fullDoc';
import invalidURLFormatDoc from '../../../data/fullDoc';
import { createSha256Signature } from '../../../utils/createSha256Signature';
import { createMockAPIGatewayEvent } from '../../../utils/createMockAPIGatewayEvent';
import { extractUrlFromMessage } from '../../../../api/handlers/jobs';
import { getBuildJobDef } from '../../../data/jobDef';

const mockJob = getBuildJobDef();

jest.mock('config', () => ({
  get: () => 'SNOOTY_SECRET',
}));

jest.mock('../../../../src/repositories/jobRepository', () => ({
  JobRepository: jest.fn().mockImplementation(() => ({
    updateWithCompletionStatus: jest.fn(() => ({ payload: mockJob })),
    getJobById: jest.fn(),
  })),
}));

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

describe('Post-build webhook tests', () => {
  const payload = {
    jobId: '64ad959b423952aeb9341fae',
  };
  const payloadString = JSON.stringify(payload);

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    jest.spyOn(mongodb, 'MongoClient').mockReturnValue({
      connect: jest.fn(),
      db: jest.fn(),
      close: jest.fn(),
    });
  });

  test('successfully completes job and performs notification', async () => {
    const signature = createSha256Signature(payloadString, 'SNOOTY_SECRET');
    const res = await SnootyBuildComplete(
      createMockAPIGatewayEvent(payloadString, { 'x-snooty-signature': signature })
    );
    expect(res.statusCode).toBe(200);
  });

  test('invalid signatures gracefully error', async () => {
    const signature = createSha256Signature(payloadString, 'NOT_SNOOTY_SECRET');
    let res = await SnootyBuildComplete(createMockAPIGatewayEvent(payloadString, { 'x-snooty-signature': signature }));
    expect(res.statusCode).toBe(401);

    // Missing signature
    res = await SnootyBuildComplete(createMockAPIGatewayEvent(payloadString));
    expect(res.statusCode).toBe(400);
  });

  test('invalid payloads gracefully error', async () => {
    const invalidPayload = { jobId: undefined };
    const payloadString = JSON.stringify(invalidPayload);
    const signature = createSha256Signature(payloadString, 'SNOOTY_SECRET');
    const res = await SnootyBuildComplete(
      createMockAPIGatewayEvent(payloadString, { 'x-snooty-signature': signature })
    );
    expect(res.statusCode).toBe(400);
  });
});
