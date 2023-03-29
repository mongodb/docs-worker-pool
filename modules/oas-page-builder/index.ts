import dotenv from 'dotenv';
// Ensures that env variables are loaded in immediately, before other imports
dotenv.config();
import { Command } from 'commander';
import { getOASMetadata } from './src/services/buildMetadata';
import { buildOpenAPIPages } from './src/services/pageBuilder';
import { ModuleOptions } from './src/types';
import { normalizeUrl } from './src/utils/normalizeUrl';
import { teardown as closeDBConnection } from './src/services/database';

const program = new Command();
program
  .usage('-- [options]')
  .requiredOption('-b, --bundle <path>', 'path to parsed bundle zip')
  .requiredOption('-o, --output <path>', 'path to the directory to output generated files')
  .requiredOption('--redoc <path>', 'path to the Redoc CLI program to run. Must be a JS file')
  .requiredOption('--repo <path>', 'path to repo being built')
  .requiredOption('--site-url <url>, url to landing page of specific docs site');

program.parse();
const options = program.opts<ModuleOptions>();

const app = async (options: ModuleOptions) => {
  const { bundle: bundlePath } = options;
  const metadata = getOASMetadata(bundlePath);
  if (!metadata) {
    console.log('No OpenAPI content pages found.');
    return;
  }

  const { siteTitle, openapiPages } = metadata;
  const oasMetadataEntries = Object.entries(openapiPages);
  const numOASPages = oasMetadataEntries.length;
  console.log(`OpenAPI content pages found: ${numOASPages}.`);

  // Normalize url since Autobuilder's MUT_PREFIX could be malformed
  options.siteUrl = normalizeUrl(options.siteUrl);

  await buildOpenAPIPages(oasMetadataEntries, { ...options, siteTitle });
};

app(options)
  .then(() => {
    console.log('Finished building OpenAPI content pages.');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(closeDBConnection);
