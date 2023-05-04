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
    await db
      .collection('repos_branches')
      .find({ project: { $in: fetch } })
      .forEach((doc: ReposBranchesDocument) => {
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
    const query = {
      project,
    };
    if (branch) {
      query['branches'] = {
        $elemMatch: { gitBranchName: branch },
      };
    }
    const res = (await db.collection('repos_branches').findOne(query)) as unknown as ReposBranchesDocument;
    // if not already set, set cache value for repo_branches
    if (!internals[project]) {
      internals[project] = res;
    }
    return res;
  } catch (e) {
    console.error(`Error while getting repo branches entry: ${e}`);
    throw e;
  }
};
