import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as mongodb from 'mongodb';

export async function handleTestDeployRequest(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const { DB_NAME, JOBS_QUEUE_URL, MONGO_ATLAS_URL } = process.env;

  const client = new mongodb.MongoClient(MONGO_ATLAS_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  return {
    statusCode: 500,
    body: 'not complete',
  };
}
