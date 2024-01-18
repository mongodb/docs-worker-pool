import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function rebuildCacheHandler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 200,
    body: 'ok',
  };
}
