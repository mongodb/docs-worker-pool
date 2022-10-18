import { pool, db } from '../../connector';
import { traverseAndMerge } from '../ToC';

// Queries pool.repos_branches for any entries for the given project and branch from a metadata entry.
const repoBranchesEntry = async (project, branch) => {
  const db = await pool();
  return db.collection('repos_branches').find({ branches: { $elemMatch: { gitBranchName: branch } }, project });
};

const hasAssociations = (metadata) => !!metadata.associated_products?.length;

// checks against a 'shared' prop on metadata entries, to ensure that we query only against shared entries
const sharedMetadataEntry = async (metadata) => {
  const snooty = await db();
  return snooty
    .collection('metadata')
    .find({
      $elemMatch: { associated_products: metadata.project },
      shared: true,
    })
    .sort({ build_id: -1 })
    .limit(1)[0];
};

// Three criteria for if a product needs to upload a new shared metadata entry:
// Are there associated products in the current metadata entry?
// Does the product name appear in an associated products entry?
// Is the metadata entry for a branch in repoBranches?
export const mergeToCAndUploadSharedMetadata = async (metadata) => {
  const { project, branch } = metadata;
  const sharedMetadata = await sharedMetadataEntry(metadata);
  const associationsPresent = hasAssociations(metadata) || sharedMetadata;
  const isStagingBranch = await !repoBranchesEntry(project, branch);
  // Short circuit execution here if there's no associations involved or the branch is NOT in repo branches
  if (!associationsPresent || isStagingBranch) return;

  queryForAndMergeToCs(metadata, sharedMetadata);
};

// fetch the associations list, either from the local document or the latest shared entry
// fetch the latest entries for each entry in the association list, using build_id to determine latest
// select the tocs from each metadata entry that we just fetched
// scan the shared metadata entry (if not local document, then latest shared entry)
// replace shared toc nodes with corresponding toc metadata entries (this should be imported from the ./ToC directory)
// upload new document with a new build_id, for frontend to consume
const queryForAndMergeToCs = async (metadata, sharedMetadataEntry) => {
  const { associated_products } = metadata.created_at > sharedMetadataEntry.created_at ? metadata : sharedMetadataEntry;
  const snooty = await db();
  const tocs = snooty.collection('metadata').aggregate([
    { $match: { project: { $in: associated_products }, build_id: { $exists: true } } },
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
  traverseAndMerge(sharedMetadataEntry, tocs);
};
