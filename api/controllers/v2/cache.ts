import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function rebuildCacheHandler(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  console.log(event.body);
  return {
    statusCode: 200,
    body: 'ok',
  };
}
