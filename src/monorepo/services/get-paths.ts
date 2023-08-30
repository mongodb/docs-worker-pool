import { GitCommitInfo } from '../types/github-types';
import { checkForSnootyToml, getSnootyDirSet } from '../utils/paths';

/**
 * This function returns the project path for a given file change from a docs repository
 * within the monorepo. This function supports nested projects.
 * @param path An added/modified/removed file path from a commit e.g. server-docs/source/index.rst
 * @param commitInfo Contains information
 * @returns
 */
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
