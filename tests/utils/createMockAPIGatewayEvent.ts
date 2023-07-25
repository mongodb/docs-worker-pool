import { APIGatewayProxyEventHeaders } from 'aws-lambda';

/**
 * Mocks the API Gateway Event object for API calls
 * @param payloadString - the payload for the event.body
 * @param headers - the headers to be included as part of the event
 * @returns a barebones API Gateway Event object
 */
export const createMockAPIGatewayEvent = (payloadString: string, headers: APIGatewayProxyEventHeaders = {}) => ({
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
