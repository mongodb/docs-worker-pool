import crypto from 'crypto';
import * as mongodb from 'mongodb';
import { APIGatewayProxyEventHeaders } from 'aws-lambda';
import { SnootyBuildComplete, extractUrlFromMessage } from '../../../../api/controllers/v1/jobs';
import validURLFormatDoc from '../../../data/fullDoc';
import invalidURLFormatDoc from '../../../data/fullDoc';

jest.mock('config', () => ({
  get: () => 'SNOOTY_SECRET',
}));

jest.mock('../../../../src/repositories/jobRepository', () => ({
  JobRepository: jest.fn().mockImplementation(() => ({
    updateWithCompletionStatus: jest.fn(),
    getJobById: jest.fn(),
  })),
}));

/**
 * Mocks the creation of a signature as if it was from Snooty
 * @param payloadString
 * @param secret
 */
const createSnootySignature = (payloadString: string, secret: string) => {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
};

/**
 * Mocks the API Gateway Event object for API calls
 * @param payloadString - the payload for the event.body
 * @param headers - the headers to be included as part of the event
 * @returns a barebones API Gateway Event object
 */
const createMockAPIGatewayEvent = (payloadString: string, headers: APIGatewayProxyEventHeaders = {}) => ({
  body: payloadString,
  headers,
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/foo',
  pathParameters: {},
  queryStringParameters: {},
  multiValueQueryStringParameters: {},
  stageVariables: {},
  resource: '',
  requestContext: {
    accountId: '',
    apiId: '',
    authorizer: {},
    protocol: 'HTTP/1.1',
    httpMethod: 'POST',
    identity: {
      accessKey: '',
      accountId: '',
      apiKey: '',
      apiKeyId: '',
      caller: '',
      clientCert: null,
      cognitoAuthenticationProvider: '',
      cognitoAuthenticationType: '',
      cognitoIdentityId: '',
      cognitoIdentityPoolId: '',
      principalOrgId: '',
      sourceIp: '',
      user: '',
      userAgent: '',
      userArn: '',
    },
    path: '/foo',
    stage: '',
    requestId: '',
    requestTimeEpoch: 0,
    resourceId: '',
    resourcePath: '',
  },
});

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
    const signature = createSnootySignature(payloadString, 'SNOOTY_SECRET');
    const res = await SnootyBuildComplete(
      createMockAPIGatewayEvent(payloadString, { 'x-snooty-signature': signature })
    );
    expect(res.statusCode).toBe(202);
  });

  test('invalid signatures gracefully error', async () => {
    const signature = createSnootySignature(payloadString, 'NOT_SNOOTY_SECRET');
    let res = await SnootyBuildComplete(createMockAPIGatewayEvent(payloadString, { 'x-snooty-signature': signature }));
    expect(res.statusCode).toBe(401);

    // Missing signature
    res = await SnootyBuildComplete(createMockAPIGatewayEvent(payloadString));
    expect(res.statusCode).toBe(400);
  });

  test('invalid payloads gracefully error', async () => {
    const invalidPayload = { jobId: undefined };
    const payloadString = JSON.stringify(invalidPayload);
    const signature = createSnootySignature(payloadString, 'SNOOTY_SECRET');
    const res = await SnootyBuildComplete(
      createMockAPIGatewayEvent(payloadString, { 'x-snooty-signature': signature })
    );
    expect(res.statusCode).toBe(400);
  });
});
