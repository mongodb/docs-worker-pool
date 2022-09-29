import * as mongodb from 'mongodb';
import { ObjectId } from 'mongodb';

const db = async () => {
  const atlasURL = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/?retryWrites=true&w=majority`;
  const client = new mongodb.MongoClient(atlasURL);
  try {
    await client.connect();
  } catch (error) {
    console.error(`Error at db client connection: ${error}`);
    throw error;
  }
  return client.db(process.env.DB_NAME);
};

// all docs should be inserted with the buildId for the run.
export const insert = async (docs, collection: string, buildId: ObjectId) => {
  try {
    const insertSession = await db();
    docs.forEach((doc) => {
      doc.buildId = buildId;
    });
    return insertSession.collection(collection).insertMany(docs);
  } catch (error) {
    console.error(`Error at insertion time for ${collection}: ${error}`);
    throw error;
  }
};
