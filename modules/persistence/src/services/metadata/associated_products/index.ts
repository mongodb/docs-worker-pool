import { AggregationCursor } from 'mongodb';
import { Metadata } from '..';
import { pool, db } from '../../connector';
import { ToCInsertions, TocOrderInsertions, traverseAndMerge, copyToCTree } from '../ToC';
import { prefixFromEnvironment } from '../ToC/utils/prefixFromEnvironment';

export interface AssociatedProduct {
  name: string;
  versions: string[];
}

export type SharedMetadata = Metadata;

interface AggregatedMetadata {
  _id: {
    project: string;
    branch: string;
  };
  most_recent: Metadata;
}

type EnvKeyedObject = {
  prd: any;
  preprd: any;
  dotcomstg: any;
  dotcomprd: any;
};
// TODO: move the branch/repobranch interfaces into their own file, or into a seperate abstraction?
export interface BranchEntry {
  name: string;
  gitBranchName: string;
  [key: string]: any;
}

export interface ReposBranchesDocument {
  repoName: string;
  project: string;
  branches: BranchEntry[];
  url: EnvKeyedObject;
  prefix: EnvKeyedObject;
  [key: string]: any;
}

// Queries pool*.repos_branches for any entries for the given project and branch from a metadata entry.
const getRepoBranchesEntry = async (project, branch) => {
  const db = await pool();
  return db.collection('repos_branches').findOne({ branches: { $elemMatch: { gitBranchName: branch } }, project });
};

// Queries pool*.repos_branches for all entries for associated_products in a shared metadata entry
const getAllAssociatedRepoBranchesEntries = async (metadata: Metadata) => {
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
      const { url, prefix } = entry;
      const branches = Object.fromEntries(entry.branches.map((branch) => [branch.gitBranchName, { ...branch }]));
      return [entry.project, { ...branches, url, prefix }];
    })
  );

export const hasAssociations = (metadata) => !!metadata.associated_products?.length;

const umbrellaMetadataEntry = async (project: string): Promise<Metadata> => {
  try {
    const snooty = await db();
    const entry = await snooty
      .collection('metadata')
      .find({
        'associated_products.name': project,
      })
      .sort({ build_id: -1 })
      .limit(1)
      .toArray();
    return entry[0] as unknown as Metadata;
  } catch (error) {
    console.log(`Error at time of querying for umbrella metadata entry: ${error}`);
    throw error;
  }
};

// Convert our cursor from the associated metadata aggregation query into a series of ToC objects and their parent metadata entries
const shapeToCsCursor = async (
  tocCursor: AggregationCursor,
  repoBranchesMap: { [k: string]: ReposBranchesDocument }
): Promise<{
  tocInsertions: ToCInsertions;
  tocOrderInsertions: TocOrderInsertions;
  associatedMetadataEntries: Metadata[];
}> => {
  const tocInsertions = {};
  const tocOrderInsertions = {};
  const associatedMetadataEntries: Metadata[] = [];

  await tocCursor.forEach((doc: AggregatedMetadata) => {
    const { project, branch } = doc._id;
    const metadata = doc.most_recent;
    // Initialize to empty object if we haven't already, for a given project.
    if (!tocInsertions[project]) tocInsertions[project] = {};
    if (!tocOrderInsertions[project]) tocOrderInsertions[project] = {};

    const branches = repoBranchesMap?.[project];
    const repoBranchesEntry = branches?.[branch];
    // TODO: If we want staging builds with embedded versions, it needs to be added here
    if (repoBranchesEntry) {
      const { url, prefix } = prefixFromEnvironment(branches);
      tocInsertions[project][branch] = {
        original: copyToCTree(metadata.toctree),
        urlified: copyToCTree(metadata.toctree, prefix, url),
      };
      // TODO: Can we urlify the order? SHOUD we urlify the order?
      tocOrderInsertions[project][branch] = metadata.toctreeOrder;
      associatedMetadataEntries.push(metadata as Metadata);
    }
  });

  return { tocInsertions, tocOrderInsertions, associatedMetadataEntries };
};

const getAssociatedProducts = async (umbrellaMetadata) => {
  try {
    const { associated_products } = umbrellaMetadata;
    const associatedProductNames = associated_products.map((a) => a.name);
    const snooty = await db();

    // This query matches on projects in associated_products for our given metadata that have a build_id and that do not have merged tocs
    // then sorts by build_id for all matches
    // then groups per branch and per project from those matches
    // and gets the first metadata entry for each group
    // since we are sorted by build_id, we get the most recent entry.
    const associatedMetadataEntries = snooty.collection('metadata').aggregate([
      {
        $match: { project: { $in: associatedProductNames }, build_id: { $exists: true }, is_merged_toc: { $ne: true } },
      },
      {
        $sort: {
          build_id: -1,
        },
      },
      {
        $group: {
          _id: { project: '$project', branch: '$branch' },
          most_recent: { $first: '$$ROOT' },
        },
      },
    ]);
    return associatedMetadataEntries;
  } catch (error) {
    console.log(`Error at time of aggregating existing associated product metadata entries: ${error}`);
    throw error;
  }
};

export const mergeAssociatedToCs = async (metadata: Metadata) => {
  try {
    const { project, branch } = metadata;
    const umbrellaMetadata = hasAssociations(metadata) ? metadata : await umbrellaMetadataEntry(project);

    // Short circuit execution here if there's no umbrella product metadata found
    if (!umbrellaMetadata) return;
    // Short circuit execution if the project branch is NOT in repo branches
    // If we want to embed with staging builds, then this needs to be turned off
    // or converted so that local metadata ToC is added to tocInsertions
    const isStagingBranch = !(await getRepoBranchesEntry(project, branch));
    if (isStagingBranch) return;

    const umbrellaRepoBranchesEntry = await getRepoBranchesEntry(umbrellaMetadata.project, umbrellaMetadata.branch);
    if (!umbrellaRepoBranchesEntry)
      throw `No repoBranches entry available for umbrella metadata with project: ${umbrellaMetadata.project}, branch: ${umbrellaMetadata.branch}`;

    const repoBranchesEntries = await getAllAssociatedRepoBranchesEntries(umbrellaMetadata);
    const repoBranchesMap = mapRepoBranches(repoBranchesEntries);
    const metadataCursor = await getAssociatedProducts(umbrellaMetadata);

    const { tocInsertions, tocOrderInsertions, associatedMetadataEntries } = await shapeToCsCursor(
      metadataCursor,
      repoBranchesMap as ReposBranchesDocument
    );

    // We need to have copies of the main umbrella product's ToC here, to handle multiple metadata entry support
    const umbrellaPrefixes = prefixFromEnvironment(umbrellaRepoBranchesEntry as any as ReposBranchesDocument);
    const umbrellaToCs = {
      original: copyToCTree(umbrellaMetadata.toctree),
      urlified: copyToCTree(umbrellaMetadata.toctree, umbrellaPrefixes.prefix, umbrellaPrefixes.url),
    };

    const mergedMetadataEntries = [umbrellaMetadata, ...associatedMetadataEntries].map((metadataEntry) => {
      const mergedMetadataEntry = traverseAndMerge(
        metadataEntry,
        umbrellaMetadata.associated_products || [],
        umbrellaToCs,
        tocInsertions,
        tocOrderInsertions
      );
      // Remove the _id and treat the entry as a brand new document.
      delete mergedMetadataEntry._id;
      // Add a flag to denote that the entry contains a merged ToC.
      mergedMetadataEntry.is_merged_toc = true;
      return mergedMetadataEntry;
    });
    return mergedMetadataEntries;
  } catch (error) {
    console.log(`Error at time of merging associated ToC entries: ${error}`);
    throw error;
  }
};

export const _getRepoBranchesEntry = getRepoBranchesEntry;
export const _getAllAssociatedRepoBranchesEntries = getAllAssociatedRepoBranchesEntries;
export const _umbrellaMetadataEntry = umbrellaMetadataEntry;
export const _getAssociatedProducts = getAssociatedProducts;
export const _shapeToCsCursor = shapeToCsCursor;
