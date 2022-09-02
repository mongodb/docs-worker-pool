import { deserialize } from 'bson';
import { insert } from '../connector';

const COLLECTION_NAME = 'documents';

// Service responsible for memoization of page level documents.
// Any extraneous logic performed on page level documents as part of upload should be added here
// or within subfolders of this module
const entriesFromZip = async (zip) => {
  const zipEntries = zip.getEntries();
  return zipEntries
    .filter((entry) => entry.entryName?.startsWith('documents/'))
    .map((entry) => deserialize(entry.getData()));
};

export const insertEntries = async (buildId, zip) => {
  const entries = await entriesFromZip(zip);
  insert(entries, COLLECTION_NAME, buildId);
};
