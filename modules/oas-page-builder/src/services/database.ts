import { Db, MongoClient } from 'mongodb';
import { OASFile, OASFilePartial } from './models/OASFile';

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

const getDbName = () => {
  return 'hapley_staging';
  const env = process.env.SNOOTY_ENV ?? '';

  switch (env) {
    // Autobuilder's prd env
    case 'production':
    case 'dotcomprd':
      return 'snooty_dotcomprd';
    // Autobuilder's pre-prd env
    case 'staging':
    case 'dotcomstg':
      return 'snooty_dotcomstg';
    default:
      // snooty_dotcomprd.oas_files should be guaranteed to have the latest data
      return 'snooty_dotcomprd';
  }
};

// Handles memoization of db object, and initial connection logic if needs to be initialized
const db = async () => {
  if (!dbInstance) {
    try {
      await client.connect();
      const dbName = getDbName();
      dbInstance = client.db(dbName);
    } catch (error) {
      console.error(`Error at db client connection: ${error}`);
      throw error;
    }
  }
  return dbInstance;
};

// Finds the last saved git hash and version data in our db for an OpenAPI spec file. The git hash
// should have an existing spec file but the hash may be subject to change every 24 hours.
export const findLastSavedVersionData = async (apiKeyword: string) => {
  const dbSession = await db();
  try {
    const projection = { gitHash: 1, versions: 1 };
    const filter = { api: apiKeyword };
    const oasFilesCollection = dbSession.collection<OASFile>(COLLECTION_NAME);
    return oasFilesCollection.findOne<OASFilePartial>(filter, { projection });
  } catch (error) {
    console.error(`Error fetching lastest git hash for API: ${apiKeyword}.`);
    throw error;
  }
};

export const saveSuccessfulBuildVersionData = async (
  apiKeyword: string,
  gitHash: string,
  versionData: { [k: string]: string[] }
) => {
  const dbSession = await db();
  try {
    const query = {
      api: apiKeyword,
    };
    const update = {
      $set: {
        gitHash: gitHash,
        versions: versionData,
        lastUpdated: new Date().toISOString(),
      },
    };
    const options = {
      upsert: true,
    };

    const oasFilesCollection = dbSession.collection<OASFile>(COLLECTION_NAME);
    // await oasFilesCollection.updateOne(query, update, options);
  } catch (error) {
    console.error(`Error updating lastest git hash and versions for API: ${apiKeyword}.`);
    throw error;
  }
};
