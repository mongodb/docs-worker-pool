import { Commit } from '@octokit/webhooks-types';
import { getOctokitClient } from '../../clients/githubClient';
import { GitCommitInfo } from '../types/github-types';

export async function checkForSnootyToml(
  path: string,
  { commitSha, ownerName, repoName }: GitCommitInfo
): Promise<boolean> {
  const client = getOctokitClient();

  try {
    await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: ownerName,
      path: `${path}/snooty.toml`,
      repo: repoName,
      ref: commitSha,
    });

    return true;
  } catch (error) {
    console.warn(`Warning. Could not retrieve snooty.toml for the following path: ${path}`);
    return false;
  }
}

let snootyDirSet: Set<string>;

export async function getSnootyDirSet({ commitSha, ownerName, repoName }: GitCommitInfo): Promise<Set<string>> {
  if (snootyDirSet) return snootyDirSet;

  try {
    const client = getOctokitClient();

    // getting the repository tree for a given commit SHA. This returns an object
    // with the property `tree` that is a flat array of all files in the repository with the path.
    // Unlike the contents API for repositories, the actual file content is not returned.
    const { data } = await client.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
      owner: ownerName,
      repo: repoName,
      tree_sha: commitSha,
      recursive: 'true',
    });

    // casting the result from `(string | undefined)[]` to `string[]` since the filter will ensure that the result
    // only includes treeNode.path values that are defined and include snooty.toml
    // in the path.
    const snootyTomlDirs = data.tree
      .filter((treeNode) => !!treeNode.path?.includes('snooty.toml'))
      .map((treeNode) => treeNode.path) as string[];

    snootyDirSet = new Set(snootyTomlDirs);

    return snootyDirSet;
  } catch (error) {
    console.error(
      `ERROR! Unable to retrieve tree for SHA: ${commitSha} owner name: ${ownerName} repo name: ${repoName}`
    );
    throw error;
  }
}

export const getUpdatedFilePaths = (commit: Commit): string[] =>
  commit.modified.concat(commit.added).concat(commit.removed);

export async function getProjectDirFromPathSet(path: string, commitInfo: GitCommitInfo): Promise<string> {
  const pathArray = path.split('/');
  if (pathArray.length === 0) {
    console.warn('WARNING! Empty path found: ', path);
    return '';
  }

  /**
   * If the changed file is the snooty.toml file, we know that we
   * are in the project's root directory. We can join the original
   * pathArray to get the project path since the snooty.toml has been removed.
   */
  const changedFile = pathArray.pop();

  if (changedFile === 'snooty.toml') return pathArray.join('/');

  const snootyDirSet = await getSnootyDirSet(commitInfo);

  while (pathArray.length > 0) {
    const currDir = pathArray.join('/');

    if (snootyDirSet.has(currDir)) return currDir;

    pathArray.pop();
  }

  console.warn(`WARNING! No snooty.toml found for the given path: ${path}`);
  return '';
}

export async function getProjectDirFromPath(path: string, commitInfo: GitCommitInfo): Promise<string> {
  const pathArray = path.split('/');

  if (pathArray.length === 0) {
    console.warn('WARNING! Empty path found: ', path);
    return '';
  }

  const changedFile = pathArray.pop();

  /**
   * If the changed file is the snooty.toml file, we know that we
   * are in the project's root directory. We can join the original
   * pathArray to get the project path since the snooty.toml has been removed.
   */
  if (changedFile === 'snooty.toml') return pathArray.join('/');

  while (pathArray.length > 0) {
    const currPath = pathArray.join('/');

    const containsSnootyToml = await checkForSnootyToml(currPath, commitInfo);

    // if the directory contains the snooty.toml file, we know that we are in the root of a project
    // directory, so the path is returned.
    if (containsSnootyToml) return currPath;

    // if snooty.toml is not found, check parent directory
    pathArray.pop();
  }

  console.warn(`WARNING! No snooty.toml found for the given path: ${path}`);
  return '';
}
