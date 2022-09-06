import AdmZip from 'adm-zip';
import minimist from 'minimist';
import mongodb from 'mongodb';
import { insertEntries } from './src/services/entries';
import { insertMetadata } from './src/services/metadata';

// Load command line args into a parameterized argv
const argv = minimist(process.argv.slice(2));

const app = async (path) => {
  try {
    const zip = new AdmZip(path);
    // atomic buildId for all artifacts read by this module - fundamental assumption
    // that only one build will be used per run of this module.
    const buildId = new mongodb.ObjectId();
    Promise.all([insertEntries(buildId, zip), insertMetadata(buildId, zip)]);
  } catch (error) {
    console.error(`ERROR: Persistence Module encountered a terminal error: ${error}`);
    throw error;
    process.exit(0);
  }
  process.exit(1);
};

app(argv['path']);
