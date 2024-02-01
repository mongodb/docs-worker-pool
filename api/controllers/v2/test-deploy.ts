import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handleTestDeployRequest(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  return {
    statusCode: 500,
    body: 'not complete',
  };
}
