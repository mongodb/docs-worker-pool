// Service that holds responsibility for initializing and exposing mdb interfaces.
// Also exports helper functions for common operations (insert, upsert one by _id, etc.)
// When adding helpers here, ask yourself if the helper will be used by more than one service
// If no, the helper should be implemented in that service, not here

import * as mongodb from 'mongodb';
import { ObjectId, Db } from 'mongodb';
import { db as poolDb } from './pool';

// We should only ever have one client active at a time.
const atlasURL = `mongodb+srv://${process.env.MONGO_ATLAS_USERNAME}:${process.env.MONGO_ATLAS_PASSWORD}@${process.env.MONGO_ATLAS_HOST}/?retryWrites=true&w=majority`;
const client = new mongodb.MongoClient(atlasURL);

export const teardown = () => {
  client.close();
};

// Initialize and export our pool connection
// Try to limit access to pool as much as possible - we mostly want it for just repo_branches.
export const pool = async () => {
  return poolDb(client);
};

// cached db object, so we can handle initial connection process once if unitialized
let dbInstance: Db;
// Handles memoization of db object, and initial connection logic if needs to be initialized
export const db = async () => {
  if (!dbInstance) {
    try {
      await client.connect();
      dbInstance = client.db(process.env.SNOOTY_DB_NAME);
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
    return await insertSession
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
    return await upsertSession.collection(collection).updateOne(query, update, options);
  } catch (error) {
    console.error(`Error at upsertion time for ${collection}: ${error}`);
    throw error;
  }
};

export const deleteDocuments = async (_ids: ObjectId[], collection: string) => {
  const deleteSession = await db();
  try {
    const query = {
      _id: { $in: _ids },
    };
    const res = await deleteSession.collection(collection).deleteMany(query);
    console.log(`Deleted ${res.deletedCount} documents in ${collection}`);
    return res;
  } catch (error) {
    console.error(`Error at delete time for ${collection}: ${error}`);
    throw error;
  }
};
