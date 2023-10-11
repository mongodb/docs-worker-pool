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

export interface ReposBranchesDocument extends WithId<Document> {
  repoName: string;
  project: string;
  branches: BranchEntry[];
  url: EnvKeyedObject;
  prefix: EnvKeyedObject;
  [key: string]: any;
}

const internals: { [key: project]: ReposBranchesDocument } = {};

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
  ];
};

// Queries pool*.repos_branches for all entries for associated_products in a shared metadata entry
export const getAllAssociatedRepoBranchesEntries = async (metadata: Metadata) => {
  const { associated_products = [] } = metadata;
  if (!associated_products.length) return [];

  const res: ReposBranchesDocument[] = [],
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
    const aggregationPipeline = getAggregationPipeline({ project: { $in: fetch } });
    const cursor = db.collection('docsets').aggregate(aggregationPipeline);
    const docsets = (await cursor.toArray()) as ReposBranchesDocument[];
    docsets.forEach((doc: ReposBranchesDocument) => {
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

// Queries pool*.repos_branches for any entries for the given project and branch from a metadata entry.
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
      prodDeployable: true,
    };
    if (branch) {
      matchCondition['branches'] = { $elemMatch: { gitBranchName: branch } };
    }
    const aggregationPipeline = getAggregationPipeline(matchCondition);

    const cursor = db.collection('docsets').aggregate(aggregationPipeline);
    const res = (await cursor.toArray()) as unknown as ReposBranchesDocument[];

    // if not already set, set cache value for repo_branches
    if (!internals[project]) {
      internals[project] = res[0];
    }
    return res[0];
  } catch (e) {
    console.error(`Error while getting repo branches entry: ${e}`);
    throw e;
  }
};
