import dotenv from 'dotenv';
// Ensures that env variables are loaded in immediately, before other imports
dotenv.config();
import minimist from 'minimist';
import { getOASMetadata } from './src/services/buildMetadata';
import { buildOpenAPIPages } from './src/services/pageBuilder';

interface ModuleArgs extends minimist.ParsedArgs {
  // bundle -- path to parsed bundle
  bundle?: string;
  // destination -- path to the directory to move the generated files to
  destination?: string;
  prefix?: string;
}

const args: ModuleArgs = minimist(process.argv.slice(2));

// Returns the missing required argument
// Should DELETE this due to TypeScript type validation issues
// const findMissingArgs = (args: ModuleArgs) => {
//   const requiredArgs = ['bundle', 'frontend'];
//   const missingArgs: string[] = [];

//   const presentArgs = new Set(Object.keys(args));
//   for (const arg of requiredArgs) {
//     if (!presentArgs.has(arg)) {
//       missingArgs.push(arg);
//     }
//   }

//   return missingArgs;
// };

const app = async ({ bundle: bundlePath, destination }: ModuleArgs) => {
  if (!(bundlePath && destination)) {
    throw 'Missing one or more required args.';
  }

  const oasMetadata = getOASMetadata(bundlePath);
  if (!oasMetadata) {
    console.log('No OpenAPI content pages found.');
    return;
  }

  const oasMetadataEntries = Object.entries(oasMetadata);
  const numOASPages = oasMetadataEntries.length;
  console.log(`OpenAPI content pages found: ${numOASPages}.`);

  await buildOpenAPIPages(oasMetadataEntries, destination);
  process.exit(0);
};

app(args)
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
