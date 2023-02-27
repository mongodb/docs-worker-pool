import { FastlyConnector } from '../../../src/services/cdn';
import { ConsoleLogger } from '../../../src/services/logger';
import { CDNCreds } from '../../../src/entities/creds';

export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
  const body = JSON.parse(event.body);
  const pair = {
    key: body.source,
    value: body.target,
  };
  // TODO: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  // Above applies for all 'process.env' variables, they should be validated
  const creds = new CDNCreds(process.env.FASTLY_DOCHUB_SERVICE_ID, process.env.FASTLY_DOCHUB_TOKEN);
  await new FastlyConnector(new ConsoleLogger()).upsertEdgeDictionaryItem(pair, process.env.FASTLY_DOCHUB_MAP, creds);
  return {
    statusCode: 202,
    headers: { 'Content-Type': 'text/plain' },
    body: 'success',
  };
};
