import AdmZip from 'adm-zip';
import * as dotenv from 'dotenv';
import minimist from 'minimist';
import * as mongodb from 'mongodb';
import { insertEntries } from './src/services/entries';
import { insertMetadata } from './src/services/metadata';

// Load command line args into a parameterized argv
const argv = minimist(process.argv.slice(2));

// Load .env, if present
dotenv.config();

const app = async (path) => {
  try {
    const zip = AdmZip(path);
    // atomic buildId for all artifacts read by this module - fundamental assumption
    // that only one build will be used per run of this module.
    const buildId = new mongodb.ObjectId();
    await Promise.all([insertEntries(buildId, zip), insertMetadata(buildId, zip)]);
  } catch (error) {
    console.error(`Persistence Module encountered a terminal error: ${error}`);
    process.exit(1);
  }
  process.exit(0);
};

app(argv['path']);
