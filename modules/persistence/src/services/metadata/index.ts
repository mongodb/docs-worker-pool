import AdmZip from 'adm-zip';
import { deserialize } from 'bson';
import { ObjectId } from 'mongodb';
import { db, deleteDocuments, insert } from '../connector';
import { mergeAssociatedToCs, AssociatedProduct } from './associated_products';
import { getRepoBranchesEntry } from './repos_branches';
import { project, ToC } from './ToC';

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
export const metadataFromZip = async (zip: AdmZip) => {
  const zipEntries = zip.getEntries();
  const metadata = zipEntries
    .filter((entry) => entry.entryName === 'site.bson')
    .map((entry) => deserialize(entry.getData()))[0] as Metadata;
  await verifyMetadata(metadata);
  return metadata;
};

// Verifies the entries for associated_products in metadata
const verifyMetadata = async (metadata: Metadata) => {
  try {
    if (!metadata['associated_products']?.length) {
      return metadata;
    }
    const invalidNames: project[] = [];
    const promises = metadata['associated_products'].map(async (ap) => {
      const branchEntry = await getRepoBranchesEntry(ap.name);
      if (!branchEntry) {
        invalidNames.push(ap.name);
      }
    });
    await Promise.all(promises);
    if (invalidNames.length) {
      console.warn(`No branches found for associated project(s) [${invalidNames}]. Removing such associated_products`);
      metadata.associated_products = metadata.associated_products.filter((ap) => !invalidNames.includes(ap.name));
    }
    if (!metadata['associated_products'].length) {
      delete metadata['associated_products'];
    }
    return metadata;
  } catch (e) {
    console.error(`Error while verifying metadata ${e}`);
    throw e;
  }
};

export const insertMetadata = async (buildId: ObjectId, metadata: Metadata) => {
  try {
    return insert([metadata], COLLECTION_NAME, buildId);
  } catch (error) {
    console.error(`Error at insertion time for ${COLLECTION_NAME}: ${error}`);
    throw error;
  }
};

export const insertMergedMetadataEntries = async (buildId: ObjectId, metadata: Metadata) => {
  try {
    const mergedMetadataEntries = await mergeAssociatedToCs(metadata);
    return mergedMetadataEntries
      ? await Promise.all(mergedMetadataEntries.map((m) => insert([m], COLLECTION_NAME, buildId)))
      : [];
  } catch (error) {
    console.error(`Error during umbrella metadata update: ${error}`);
    throw error;
  }
};

export const deleteStaleMetadata = async (metadata: Metadata) => {
  try {
    const { project, branch } = metadata;
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
