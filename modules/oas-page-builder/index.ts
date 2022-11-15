// node ./dist/index.js --path
import minimist from 'minimist';
import { getOASMetadata } from './src/services/buildMetadata';

interface ModuleArgs extends minimist.ParsedArgs {
  source?: string;
}

const argv: ModuleArgs = minimist(process.argv.slice(2));

const app = (sourcePath: string) => {
  const oasMetadata = getOASMetadata(sourcePath);

  if (!oasMetadata) {
    console.log('No OpenAPI content pages found.');
    return;
  }

  const oasMetadataEntries = Object.entries(oasMetadata);
  const numOASPages = oasMetadataEntries.length;
  console.log(`OpenAPI content pages found: ${numOASPages}.`);
};

try {
  const { source } = argv;
  if (!source) throw Error('source path required');
  app(source);
} catch (e) {
  console.error(e);
  process.exit(1);
}
