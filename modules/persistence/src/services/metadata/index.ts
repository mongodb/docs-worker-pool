import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { ObjectId } from 'mongodb';
import { insert } from '../connector';

const COLLECTION_NAME = 'metadata';

// Service responsible for memoization of metadata entries.
// Any extraneous logic performed on metadata entries as part of upload should be added here
// or within subfolders of this module

const metadataFromZip = (zip: AdmZip) => {
  const zipEntries = zip.getEntries();
  return zipEntries.filter((entry) => entry.entryName === 'site.bson').map((entry) => deserialize(entry.getData()));
};

export const insertMetadata = async (buildId: ObjectId, zip: AdmZip) => {
  try {
    const metadata = await metadataFromZip(zip);
    return insert(metadata, COLLECTION_NAME, buildId);
  } catch (error) {
    console.error(`Error at insertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};
