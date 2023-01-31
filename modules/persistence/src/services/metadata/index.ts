import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { ObjectId } from 'mongodb';
import { db, deleteDocuments, insert } from '../connector';
import { mergeAssociatedToCs, AssociatedProduct } from './associated_products';
import { ToC } from './ToC';

const COLLECTION_NAME = 'metadata';

export interface Metadata {
  project: string;
  branch: string;
  associated_products?: AssociatedProduct[];
  toctree: ToC;
  toctreeOrder: any[];
  [key: string]: any;
}
// Service responsible for memoization of metadata entries.
// Any extraneous logic performed on metadata entries as part of upload should be added here
// or within subfolders of this module
const metadataFromZip = (zip: AdmZip) => {
  const zipEntries = zip.getEntries();
  return zipEntries
    .filter((entry) => entry.entryName === 'site.bson')
    .map((entry) => deserialize(entry.getData()))[0] as Metadata;
};

export const insertMetadata = async (buildId: ObjectId, zip: AdmZip) => {
  try {
    const metadata = await metadataFromZip(zip);
    return insert([metadata], COLLECTION_NAME, buildId);
  } catch (error) {
    console.error(`Error at insertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};

export const insertMergedMetadataEntries = async (buildId: ObjectId, zip: AdmZip) => {
  try {
    const mergedMetadataEntries = await mergeAssociatedToCs(metadataFromZip(zip));
    return mergedMetadataEntries
      ? await Promise.all(mergedMetadataEntries.map((m) => insert([m], COLLECTION_NAME, buildId)))
      : [];
  } catch (error) {
    console.error(`Error during umbrella metadata update: ${error}`);
    throw error;
  }
};

export const deleteStaleMetadata = async (zip: AdmZip) => {
  try {
    const { project, branch } = metadataFromZip(zip);
    const LIMIT = 4;
    // get most recent metadata for this project-branch
    const snooty = await db();
    const entries = await snooty
      .collection(COLLECTION_NAME)
      .find({
        project,
        branch,
      })
      .sort({
        build_id: -1,
        _id: -1,
      })
      .toArray();

    const deleteCandidateIds = entries.slice(LIMIT).map((doc) => doc._id);
    return await deleteDocuments(deleteCandidateIds, COLLECTION_NAME);
  } catch (error) {
    console.error(`Error deleting stale metadata: ${error}`);
    throw error;
  }
};

export const _metadataFromZip = metadataFromZip;
