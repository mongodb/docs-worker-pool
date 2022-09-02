import * as mongodb from 'mongodb';
import c from 'config';

const db = async () => {
  const atlasURL = `mongodb+srv://${c.get('dbUsername')}:${c.get('dbPassword')}@${c.get(
    'dbHost'
  )}/?retryWrites=true&w=majority`;
  const client = new mongodb.MongoClient(atlasURL);
  await client.connect();
  return client.db(c.get('dbName'));
};

// all docs should be inserted with the buildId for the run.
export const insert = async (docs, collection, buildId) => {
  const insertSession = await db();
  docs.forEach((doc) => {
    doc.buildId = buildId;
  });
  return insertSession.collection(collection).insertMany(docs);
};
