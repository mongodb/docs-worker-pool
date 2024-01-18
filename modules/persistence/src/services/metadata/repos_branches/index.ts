import { pool } from '../../connector';
import { Metadata } from '..';
import { project } from '../ToC';
import { WithId } from 'mongodb';

type EnvKeyedObject = {
  prd: any;
  preprd: any;
  dotcomstg: any;
  dotcomprd: any;
};

export interface BranchEntry {
  name: string;
  gitBranchName: string;
  [key: string]: any;
}

export interface DocsetsDocument extends WithId<Document> {
  url: EnvKeyedObject;
  prefix: EnvKeyedObject;
  bucket: EnvKeyedObject;
}

export interface ReposBranchesDocument extends WithId<Document> {
  repoName: string;
  project: string;
  branches: BranchEntry[];
  internalOnly: boolean;
  [key: string]: any;
}

export type ReposBranchesDocsetsDocument = ReposBranchesDocument & DocsetsDocument;

const internals: { [key: project]: ReposBranchesDocsetsDocument } = {};

const getAggregationPipeline = (matchCondition: any) => {
  return [
    // Stage 1: Unwind the repos array to create multiple documents for each referenced repo
    {
      $unwind: '$repos',
    },
    // Stage 2: Lookup to join with the repos_branches collection
    {
      $lookup: {
        from: 'repos_branches',
        localField: 'repos',
        foreignField: '_id',
        as: 'repo',
      },
    },
    // Stage 3: Merge/flatten repo into docset
    {
      $replaceRoot: { newRoot: { $mergeObjects: [{ $arrayElemAt: ['$repo', 0] }, '$$ROOT'] } },
    },
    // Stage 4: Match documents based on given field(s)
    {
      $match: matchCondition,
    },
    // Stage 5: Exclude fields
    {
      $project: {
        _id: 0,
        repos: 0,
        repo: 0,
      },
    },
    {
      $sort: {
        prodDeployable: -1,
      },
    },
  ];
};

// Queries pool*.repos_branches for all entries for associated_products in a shared metadata entry
export const getAllAssociatedRepoBranchesEntries = async (metadata: Metadata) => {
  const { associated_products = [] } = metadata;
  if (!associated_products.length) return [];

  const res: ReposBranchesDocsetsDocument[] = [],
    fetch: project[] = [];
  associated_products.forEach((ap) => {
    if (internals[ap.name]) {
      res.push(internals[ap.name]);
    } else {
      fetch.push(ap.name);
    }
  });

  if (!fetch.length) {
    return res;
  }

  try {
    const db = await pool();
    const aggregationPipeline = getAggregationPipeline({ project: { $in: fetch }, internalOnly: false });
    const cursor = db.collection('docsets').aggregate(aggregationPipeline);
    const docsets = (await cursor.toArray()) as DocsetsDocument[];
    docsets.forEach((doc: ReposBranchesDocsetsDocument) => {
      // TODO: store in cache
      internals[doc['project']] = doc;
      res.push(doc);
    });
    return res;
  } catch (e) {
    console.error(`Error while getting associated repo branches: ${e}`);
    throw e;
  }
};

// Queries pool*.repos_branches and pool*. for any entries for the given project and branch from a metadata entry.
export const getRepoBranchesEntry = async (project: project, branch = ''): Promise<ReposBranchesDocument> => {
  const cachedDoc = internals[project];
  // return cached repo doc if exists
  if (cachedDoc !== undefined) {
    if (!branch) {
      return cachedDoc;
    }

    return cachedDoc.branches.map((b) => b.gitBranchName).includes(branch)
      ? cachedDoc
      : (null as unknown as ReposBranchesDocument);
  }

  // get from DB if not cached
  try {
    const db = await pool();
    const matchCondition = {
      project,
      // We want the repo branches of the single deployable repo for a docset
      internalOnly: false,
    };
    if (branch) {
      matchCondition['branches'] = { $elemMatch: { gitBranchName: branch } };
    }
    const aggregationPipeline = getAggregationPipeline(matchCondition);

    const cursor = db.collection('docsets').aggregate(aggregationPipeline);
    const res = (await cursor.toArray()) as unknown as ReposBranchesDocsetsDocument[];
    const returnedEntry = res[0];

    if (res.length > 1) {
      console.warn(
        `Expected 1 deployable repo for docset with project "${project}", but found ${res.length} instead. Defaulting to first found: "${returnedEntry.repoName}".`
      );
    }

    // if not already set, set cache value for docsets
    if (!internals[project]) {
      internals[project] = returnedEntry;
    }
    return returnedEntry;
  } catch (e) {
    console.error(`Error while getting repo branches entry: ${e}`);
    throw e;
  }
};
