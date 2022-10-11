import * as mongodb from 'mongodb';
import { ObjectId, Db } from 'mongodb';

// We should only ever have one client active at a time.
const atlasURL = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/?retryWrites=true&w=majority`;
const client = new mongodb.MongoClient(atlasURL);
// cached db object, so we can handle initial connection process once if unitialized
let dbInstance: Db;

// Handles memoization of db object, and initial connection logic if needs to be initialized
const db = async () => {
  if (!dbInstance) {
    try {
      await client.connect();
      dbInstance = client.db(process.env.DB_NAME);
    } catch (error) {
      console.error(`Error at db client connection: ${error}`);
      throw error;
    }
  }
  return dbInstance;
};

// all docs should be inserted with the buildId for the run.
export const insert = async (docs: any[], collection: string, buildId: ObjectId) => {
  const insertSession = await db();
  try {
    return insertSession
      .collection(collection)
      .insertMany(docs.map((d) => ({ ...d, build_id: buildId, created_at: buildId.getTimestamp() })));
  } catch (error) {
    console.error(`Error at insertion time for ${collection}: ${error}`);
    throw error;
  }
};

// Upsert wrapper, requires an _id field.
export const upsert = async (payload: any, collection: string, _id: string | ObjectId) => {
  const upsertSession = await db();
  try {
    const query = { _id };
    const update = { $set: payload };
    const options = { upsert: true };
    return upsertSession.collection(collection).updateOne(query, update, options);
  } catch (error) {
    console.error(`Error at upsertion time for ${collection}: ${error}`);
  }
};
