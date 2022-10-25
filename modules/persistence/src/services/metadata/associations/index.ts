import { AggregationCursor } from 'mongodb';
import { pool, db } from '../../connector';
import { ToC, ToCInsertions, TocOrderInsertions, traverseAndMerge } from '../ToC';

export interface AssociatedProduct {
  name: string;
  versions: string[];
}

export interface SharedMetadata {
  project: string;
  branch: string;
  associated_products?: AssociatedProduct[];
  toctree: ToC;
  [key: string]: any;
}

// Queries pool.repos_branches for any entries for the given project and branch from a metadata entry.
const repoBranchesEntry = async (project, branch) => {
  const db = await pool();
  return db.collection('repos_branches').find({ branches: { $elemMatch: { gitBranchName: branch } }, project });
};

const hasAssociations = (metadata) => !!metadata.associated_products?.length;

const sharedMetadataEntry = async (metadata): Promise<SharedMetadata> => {
  try {
    const snooty = await db();
    return snooty
      .collection('metadata')
      .find({
        $elemMatch: { associated_products: metadata.project },
      })
      .sort({ build_id: -1 })
      .limit(1)[0];
  } catch (error) {
    console.log(`Error at time of querying for umbrella metadata entry: ${error}`);
    throw error;
  }
};

// Convert our cursor from the shared ToC aggregation query into a series of ToC objects
const shapeToCsCursor = async (
  tocCursor: AggregationCursor
): Promise<{ tocInsertions: ToCInsertions; tocOrderInsertions: TocOrderInsertions }> => {
  let tocInsertions, tocOrderInsertions;
  await tocCursor.forEach((doc) => {
    tocInsertions[doc._id.project][doc._id.branch] = doc.most_recent.tocTree;
    tocOrderInsertions[doc._id.project][doc._id.branch] = doc.most_recent.tocTreeOrder;
  });
  return { tocInsertions, tocOrderInsertions };
};

const queryForAssociatedProducts = async (metadata, sharedMetadataEntry) => {
  try {
    // Do a comparison between the local metadata entry and the shared me
    const localNewerThanShared = metadata.created_at > sharedMetadataEntry.created_at;
    const { associated_products } = localNewerThanShared ? metadata : sharedMetadataEntry;
    const associatedProductNames = associated_products.map((a) => a.name);
    const snooty = await db();

    // This query matches on projects in associated_products for our given metadata that have a build_id
    // then groups per branch and per project from those matches
    // and gets the most recent doc entry (by build_id), with the toctree and toctreeOrder fields.
    const tocs = snooty.collection('metadata').aggregate([
      { $match: { project: { $in: associatedProductNames }, build_id: { $exists: true } } },
      {
        $group: {
          _id: { project: '$project', branch: '$branch' },
          most_recent: {
            $max: {
              build_id: '$build_id',
              toctree: '$toctree',
              toctreeOrder: '$toctreeOrder',
            },
          },
        },
      },
    ]);
    return shapeToCsCursor(tocs);
  } catch (error) {
    console.log(`Error at time of aggregating existing associated product metadata entries: ${error}`);
    throw error;
  }
};

export const mergeAssociatedToCs = async (metadata) => {
  const { project, branch } = metadata;
  const sharedMetadata = hasAssociations(metadata) ? metadata : await sharedMetadataEntry(metadata);
  // Short circuit execution here if there's no umbrella product metadata found
  if (!sharedMetadata) return;

  // Short circuit execution if the project branch is NOT in repo branches
  const isStagingBranch = await !repoBranchesEntry(project, branch);
  if (isStagingBranch) return;

  const { tocInsertions, tocOrderInsertions } = await queryForAssociatedProducts(metadata, sharedMetadata);
  return traverseAndMerge(sharedMetadata, tocInsertions, tocOrderInsertions);
};
