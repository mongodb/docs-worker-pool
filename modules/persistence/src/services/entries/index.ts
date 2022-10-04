import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { ObjectId } from 'mongodb';
import { insert } from '../connector';

const COLLECTION_NAME = 'documents';

// Service responsible for memoization of page level documents.
// Any extraneous logic performed on page level documents as part of upload should be added here
// or within subfolders of this module
const entriesFromZip = (zip: AdmZip) => {
  const zipEntries = zip.getEntries();
  return zipEntries
    .filter((entry) => entry.entryName?.startsWith('documents/'))
    .map((entry) => deserialize(entry.getData()));
};

export const insertEntries = async (buildId: ObjectId, zip: AdmZip) => {
  try {
    const entries = await entriesFromZip(zip);
    return insert(entries, COLLECTION_NAME, buildId);
  } catch (error) {
    console.error(`Error at insertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};
