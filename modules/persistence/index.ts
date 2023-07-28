import * as dotenv from 'dotenv';
// dotenv.config() should be invoked immediately, before any other imports, to ensure config is present
dotenv.config();

import AdmZip from 'adm-zip';
import minimist from 'minimist';
import * as mongodb from 'mongodb';
import { teardown as closeDBConnection } from './src/services/connector';
import { insertAndUpdatePages } from './src/services/pages';
import {
  insertMetadata,
  insertMergedMetadataEntries,
  deleteStaleMetadata,
  metadataFromZip,
} from './src/services/metadata';
import { upsertAssets } from './src/services/assets';

interface ModuleArgs {
  path: string;
  githubUser: string;
  strict: string;
  [props: string | number | symbol]: unknown;
}

const missingPathMessage = 'No path specified in arguments - please specify a build directory at arg "path"';

// Callable via npm run start, with -- --path='' --strict=''
// being accepted args
// Also callable w/ default args via npm run dev
// Load command line args into a parameterized argv
const argv: ModuleArgs = minimist(process.argv.slice(2));

const app = async (path: string, githubUser: string) => {
  try {
    if (!path) throw missingPathMessage;
    const zip = new AdmZip(path);
    // atomic buildId for all artifacts read by this module - fundamental assumption
    // that only one build will be used per run of this module.
    const buildId = new mongodb.ObjectId();
    const metadata = await metadataFromZip(zip, githubUser);
    await Promise.all([
      insertAndUpdatePages(buildId, zip, githubUser),
      insertMetadata(buildId, metadata),
      upsertAssets(zip),
    ]);
    await insertMergedMetadataEntries(buildId, metadata);
    // DOP-3447 clean up stale metadata
    await deleteStaleMetadata(metadata);
    await closeDBConnection();
    process.exit(0);
  } catch (error) {
    console.error(`Persistence Module encountered a terminal error: ${error}`);
    await closeDBConnection();
    throw error;
  }
};

console.log(argv);
app(argv['path'], argv['githubUser']).catch((error) => {
  console.error('HEY WE ARE IN FINAL CATCH');
  console.error('argv strict ', argv['strict']);
  console.error('conditional result ', ['y', 'yes', 'true'].includes(argv['strict']));
  process.exit(1);
  // only exit with non zero error code if running with strict mode on
  if (['y', 'yes', 'true'].includes(argv['strict'].toLowerCase())) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});

// try {
//   console.log(argv);
//   app(argv['path'], argv['githubUser']);
// } catch (error) {
//   console.error('HEY WE ARE IN FINAL CATCH');
//   console.error('argv error ', argv);
//   console.log('argv ', argv);
//   console.log('caught in terminal handling');
//   // only exit with non zero error code if running with strict mode on
//   if (['y', 'yes', 'true'].includes(argv['strict'].toLowerCase())) {
//     process.exit(1);
//   } else {
//     process.exit(0);
//   }
// }
