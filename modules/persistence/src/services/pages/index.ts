import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { ObjectId } from 'mongodb';
import { insert } from '../connector';

const COLLECTION_NAME = 'documents';

// Service responsible for memoization of page level documents.
// Any extraneous logic performed on page level documents as part of upload should be added here
// or within subfolders of this module
const pagesFromZip = (zip: AdmZip) => {
  const zipPages = zip.getEntries();
  return zipPages
    .filter((entry) => entry.entryName?.startsWith('documents/'))
    .map((entry) => deserialize(entry.getData()));
};

export const insertPages = async (buildId: ObjectId, zip: AdmZip) => {
  try {
    const pages = await pagesFromZip(zip);
    return insert(pages, COLLECTION_NAME, buildId);
  } catch (error) {
    console.error(`Error at insertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};
