import dotenv from 'dotenv';
// Ensures that env variables are loaded in immediately, before other imports
dotenv.config();
import { Command } from 'commander';
import { getOASMetadata } from './src/services/buildMetadata';
import { buildOpenAPIPages } from './src/services/pageBuilder';
import { ModuleOptions } from './src/types';

const program = new Command();
program
  .usage('-- [options]')
  .requiredOption('-b, --bundle <path>', 'path to parsed bundle zip')
  .requiredOption('-d, --destination <path>', 'path to the directory to output generated files')
  .requiredOption('--redoc <path>', 'path to the Redoc CLI program to run. Must be a JS file')
  .requiredOption('--repo <path>', 'path to repo being built');

program.parse();
const options = program.opts<ModuleOptions>();

const app = async (options: ModuleOptions) => {
  const { bundle: bundlePath } = options;
  const oasMetadata = getOASMetadata(bundlePath);
  if (!oasMetadata) {
    console.log('No OpenAPI content pages found.');
    return;
  }

  const oasMetadataEntries = Object.entries(oasMetadata);
  const numOASPages = oasMetadataEntries.length;
  console.log(`OpenAPI content pages found: ${numOASPages}.`);

  await buildOpenAPIPages(oasMetadataEntries, options);
};

app(options)
  .then(() => {
    console.log('Finished building OpenAPI content pages.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
