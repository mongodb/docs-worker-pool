import { Commit } from '@octokit/webhooks-types';
import { getOctokitClient } from '../../clients/githubClient';
import { GitCommitInfo } from '../types/github-types';

async function checkForSnootyToml(path: string, commitInfo: GitCommitInfo): Promise<boolean> {
  const { commitSha, ownerName, repoName } = commitInfo;
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

export const getUpdatedFilePaths = (commit: Commit): string[] =>
  commit.modified.concat(commit.added).concat(commit.removed);

export async function getProjectDirFromPath(path: string, commitInfo: GitCommitInfo): Promise<string> {
  // Change this. Need to find source directory and work way up
  // I think I'll also need to do work to query for the docset object and confirm that
  // the source exists in the right spot
  const pathArray = path.split('/');

  console.log(path);

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
