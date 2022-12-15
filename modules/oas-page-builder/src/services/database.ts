import { Db, MongoClient } from 'mongodb';
import { OASFile, OASFileGitHash } from './models/OASFile';

const DB_NAME = 'snooty_dotcomprd';
const COLLECTION_NAME = 'oas_files';

const getAtlasURL = () => {
  const isHostLocal = process.env.DB_HOST?.includes('localhost');
  if (isHostLocal) {
    return `mongodb://${process.env.MONGO_ATLAS_HOST}/?retryWrites=true&w=majority`;
  }
  return `mongodb+srv://${process.env.MONGO_ATLAS_USERNAME}:${process.env.MONGO_ATLAS_PASSWORD}@${process.env.MONGO_ATLAS_HOST}/?retryWrites=true&w=majority`;
};

const atlasURL = getAtlasURL();
const client = new MongoClient(atlasURL);
// cached db object, so we can handle initial connection process once if unitialized
let dbInstance: Db;

// Handles memoization of db object, and initial connection logic if needs to be initialized
const db = async () => {
  if (!dbInstance) {
    try {
      await client.connect();
      dbInstance = client.db(DB_NAME);
    } catch (error) {
      console.error(`Error at db client connection: ${error}`);
      throw error;
    }
  }
  return dbInstance;
};

// Finds the last saved git hash in our db for an OpenAPI spec file. This git hash
// should have an existing spec file but the hash may be subject to change every 24 hours.
export const findLastSavedGitHash = async (apiKeyword: string) => {
  const dbSession = await db();
  try {
    const projection = { gitHash: 1 };
    const filter = { api: apiKeyword };
    const oasFilesCollection = dbSession.collection<OASFile>(COLLECTION_NAME);
    return oasFilesCollection.findOne<OASFileGitHash>(filter, { projection });
  } catch (error) {
    console.error(`Error fetching lastest git hash for API: ${apiKeyword}.`);
    throw error;
  }
};
