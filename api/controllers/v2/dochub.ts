import { FastlyConnector } from '../../../src/services/cdn';
import { ConsoleLogger } from '../../../src/services/logger';
import { CDNCreds } from '../../../src/entities/creds';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

export const UpsertEdgeDictionaryItem = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: 'event.body is null',
    };
  }

  const body = JSON.parse(event.body);

  const pair = {
    key: body.source,
    value: body.target,
  };

  const { FASTLY_DOCHUB_SERVICE_ID, FASTLY_DOCHUB_TOKEN, FASTLY_DOCHUB_MAP } = process.env;

  if (!FASTLY_DOCHUB_SERVICE_ID) {
    return {
      statusCode: 500,
      body: 'Fastly dochub service ID is not defined',
    };
  }

  if (!FASTLY_DOCHUB_TOKEN) {
    return {
      statusCode: 500,
      body: 'Fastly dochub token is not defined',
    };
  }

  if (!FASTLY_DOCHUB_MAP) {
    return {
      statusCode: 500,
      body: 'Fastly dochub map is not defined',
    };
  }

  const creds = new CDNCreds(FASTLY_DOCHUB_SERVICE_ID, FASTLY_DOCHUB_TOKEN);
  await new FastlyConnector(new ConsoleLogger()).upsertEdgeDictionaryItem(pair, FASTLY_DOCHUB_MAP, creds);
  return {
    statusCode: 202,
    headers: { 'Content-Type': 'text/plain' },
    body: 'success',
  };
};
