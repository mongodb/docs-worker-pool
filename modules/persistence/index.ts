import * as dotenv from 'dotenv';
// dotenv.config() should be invoked immediately, before any other imports, to ensure config is present
dotenv.config();

import AdmZip from 'adm-zip';
import minimist from 'minimist';
import * as mongodb from 'mongodb';
import { insertEntries } from './src/services/entries';
import { insertMetadata } from './src/services/metadata';

interface ModuleArgs {
  path: string;
  strict: string;
  [props: string | number | symbol]: unknown;
}

const missingPathMessage = 'No path specified in arguments - please specify a build directory at arg "path"';

// Callable via npm run dev, with -- -path='' -strict=''
// being accepted args
// Load command line args into a parameterized argv
const argv: ModuleArgs = minimist(process.argv.slice(2));

const app = async (path: string) => {
  try {
    if (!path) throw missingPathMessage;
    const zip = new AdmZip(path);
    // atomic buildId for all artifacts read by this module - fundamental assumption
    // that only one build will be used per run of this module.
    const buildId = new mongodb.ObjectId();
    await Promise.all([insertEntries(buildId, zip), insertMetadata(buildId, zip)]);
    process.exit(0);
  } catch (error) {
    console.error(`Persistence Module encountered a terminal error: ${error}`);
    throw error;
  }
};

try {
  console.log(argv);
  app(argv['path']);
} catch (error) {
  console.log('caught in terminal handling');
  // only exit with non zero error code if running with strict mode on
  if (['y', 'yes', 'true'].includes(argv['strict'].toLowerCase())) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
