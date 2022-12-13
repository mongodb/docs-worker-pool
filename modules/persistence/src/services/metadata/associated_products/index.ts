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
  toctreeOrder: any[];
  [key: string]: any;
}

// TODO: move the branch/repobranch interfaces into their own file, or into a seperate abstraction?
interface BranchEntry {
  name: string;
  gitBranchName: string;
  [key: string]: any;
}

export interface ReposBranchesDocument {
  repoName: string;
  project: string;
  branches: BranchEntry[];
  [key: string]: any;
}

// Queries pool*.repos_branches for any entries for the given project and branch from a metadata entry.
const getRepoBranchesEntry = async (project, branch) => {
  const db = await pool();
  return db.collection('repos_branches').findOne({ branches: { $elemMatch: { gitBranchName: branch } }, project });
};

// Queries pool*.repos_branches for all entries for associated_products in a shared metadata entry
const getAllAssociatedRepoBranchesEntries = async (metadata: SharedMetadata) => {
  const { associated_products } = metadata;
  if (!associated_products || !associated_products.length) return [];
  const associatedProductNames = associated_products.map((a) => a.name);
  const db = await pool();
  const entries = await db
    .collection('repos_branches')
    .find({ project: { $in: associatedProductNames } })
    .toArray();
  return entries as unknown as ReposBranchesDocument[];
};

const mapRepoBranches = (repoBranches: ReposBranchesDocument[]) =>
  Object.fromEntries(
    repoBranches.map((entry) => {
      const branches = Object.fromEntries(entry.branches.map((branch) => [branch.gitBranchName, branch]));
      return [entry.project, branches];
    })
  );

const hasAssociations = (metadata) => !!metadata.associated_products?.length;

const umbrellaMetadataEntry = async (metadata): Promise<SharedMetadata> => {
  try {
    const snooty = await db();
    const entry = await snooty
      .collection('metadata')
      .find({
        'associated_products.name': metadata.project,
      })
      .sort({ build_id: -1 })
      .limit(1)
      .toArray();
    return entry[0] as unknown as SharedMetadata;
  } catch (error) {
    console.log(`Error at time of querying for umbrella metadata entry: ${error}`);
    throw error;
  }
};

// Convert our cursor from the shared ToC aggregation query into a series of ToC objects
const shapeToCsCursor = async (
  tocCursor: AggregationCursor,
  repoBranchesMap
): Promise<{ tocInsertions: ToCInsertions; tocOrderInsertions: TocOrderInsertions }> => {
  const tocInsertions = {};
  const tocOrderInsertions = {};

  await tocCursor.forEach((doc) => {
    // Initialize to empty object if we haven't already, for a given project.
    if (!tocInsertions[doc._id.project]) tocInsertions[doc._id.project] = {};
    if (!tocOrderInsertions[doc._id.project]) tocOrderInsertions[doc._id.project] = {};

    // TODO: If we want staging builds with embedded versions, it needs to be added here
    if (repoBranchesMap?.[doc._id.project]?.[doc._id.branch]) {
      tocInsertions[doc._id.project][doc._id.branch] = doc.most_recent.toctree;
      tocOrderInsertions[doc._id.project][doc._id.branch] = doc.most_recent.toctreeOrder;
    }
  });

  return { tocInsertions, tocOrderInsertions };
};

const getAssociatedProducts = async (umbrellaMetadata) => {
  try {
    const { associated_products } = umbrellaMetadata;
    const associatedProductNames = associated_products.map((a) => a.name);
    const snooty = await db();

    // This query matches on projects in associated_products for our given metadata that have a build_id and that do not have merged tocs
    // then groups per branch and per project from those matches
    // and gets the most recent doc entry (by build_id), with the toctree and toctreeOrder fields.
    const tocs = snooty.collection('metadata').aggregate([
      {
        $match: { project: { $in: associatedProductNames }, build_id: { $exists: true }, is_merged_toc: { $ne: true } },
      },
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
    return tocs;
  } catch (error) {
    console.log(`Error at time of aggregating existing associated product metadata entries: ${error}`);
    throw error;
  }
};

export const mergeAssociatedToCs = async (metadata) => {
  const { project, branch } = metadata;
  const umbrellaMetadata = hasAssociations(metadata) ? metadata : await umbrellaMetadataEntry(metadata);

  // Short circuit execution here if there's no umbrella product metadata found
  if (!umbrellaMetadata) return;
  // Short circuit execution if the project branch is NOT in repo branches
  // If we want to embed with staging builds, then this needs to be turned off
  // or converted so that local metadata ToC is added to tocInsertions
  const isStagingBranch = await !getRepoBranchesEntry(project, branch);
  if (isStagingBranch) return;

  const repoBranchesEntries = await getAllAssociatedRepoBranchesEntries(umbrellaMetadata);
  const repoBranchesMap = mapRepoBranches(repoBranchesEntries);
  const tocsCursor = await getAssociatedProducts(umbrellaMetadata);
  const { tocInsertions, tocOrderInsertions } = await shapeToCsCursor(tocsCursor, repoBranchesMap);
  const mergedMetadataEntry = traverseAndMerge(umbrellaMetadata, tocInsertions, tocOrderInsertions);

  // Remove the _id and treat the entry as a brand new document.
  delete mergedMetadataEntry._id;
  // Add a flag to denote that the entry contains a merged ToC.
  mergedMetadataEntry.is_merged_toc = true;

  return mergedMetadataEntry;
};

export const _getRepoBranchesEntry = getRepoBranchesEntry;
export const _getAllAssociatedRepoBranchesEntries = getAllAssociatedRepoBranchesEntries;
export const _umbrellaMetadataEntry = umbrellaMetadataEntry;
