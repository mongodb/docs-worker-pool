import * as mongodb from 'mongodb';
import c from 'config';

export const db = async () => {
  const atlasURL = `mongodb+srv://${c.get('dbUsername')}:${c.get('dbPassword')}@${c.get(
    'dbHost'
  )}/?retryWrites=true&w=majority`;
  const client = new mongodb.MongoClient(atlasURL);
  await client.connect();
  return client.db(c.get('dbName'));
};
