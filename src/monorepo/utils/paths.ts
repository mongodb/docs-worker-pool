import { getOctokitClient } from '../../clients/githubClient';
import { GitCommitInfo } from '../types/github-types';

export const RST_EXTENSIONS = new Set(['.txt', '.rst']);

async function checkForSnootyToml(path: string, commitInfo: GitCommitInfo): Promise<boolean> {
  const client = getOctokitClient();

  try {
    const res = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'mongodb', // TODO: Add repo info from GitHub push event
      path,
      repo: 'monorepo',
      ref: '', // TODO: Provide commit from push event
    });

    res.status;

    return true;
  } catch (error) {
    console.warn(`Warning. Could not retrieve snooty.toml for the following path: ${path}`);
    return false;
  }
}

export async function getProjectDirFromPath(path: string, commitInfo: GitCommitInfo): Promise<string> {
  // Change this. Need to find source directory and work way up
  // I think I'll also need to do work to query for the docset object and confirm that
  // the source exists in the right spot
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

  while (pathArray.length > 0) {}

  const projectDirectory = pathArray[0];
  return projectDirectory;
}
