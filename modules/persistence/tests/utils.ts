/**
 * Test utilities
 *
 * Export functions to set/mock environments (ie. jest mocks)
 */

import { Db, MongoClient, ObjectId } from 'mongodb';
import metadata from './data/metadata.json';
import repoBranches from './data/repos_branches.json';

/**
 * mocks a db with test data in ./data collection
 * designed to set up test modules with fresh db
 *
 * @param dbName designated db name for target test module
 * @returns [Db, MongoClient]
 */
export const setMockDB = async (dbName: string = new ObjectId().toString()): Promise<[Db, MongoClient]> => {
  try {
    // process.env.MONGO_URL defaults to mongodb://127.0.0.1:58144/
    // https://github.com/shelfio/jest-mongodb#3-configure-mongodb-client
    // or update jest-mongodb-config.js
    const connection = await MongoClient.connect(process.env.MONGO_URL || 'test');
    const mockDb = connection.db(dbName);
    await mockDb.collection('repos_branches').insertMany(repoBranches as unknown[] as Document[]);
    await mockDb.collection('metadata').insertMany(metadata as unknown[] as Document[]);
    return [mockDb, connection];
  } catch (e) {
    console.error(e);
    throw e;
  }
};

/**
 * Deletes all test data in all collections in documents and closes db connection
 *
 * @param db
 * @param connection
 * @returns
 */
export const closeDb = async (db: Db, connection: MongoClient) => {
  try {
    const collections = await db.listCollections().toArray();

    await Promise.all(
      collections.map(async (collection) => {
        return db.collection(collection.name).deleteMany({});
      })
    );

    return connection.close();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
