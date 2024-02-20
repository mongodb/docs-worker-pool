import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handleTestDeployRequest(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const jobsQueueUrl = process.env.JOBS_QUEUE_URL;

  return {
    statusCode: 500,
    body: 'not complete',
  };
}
