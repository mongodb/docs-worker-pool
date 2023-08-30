import { SNOOTY_TOML_FILENAME } from '../utils/monorepo-constants';

/**
 * This function returns the project path for a given file change from a docs repository
 * within the monorepo. This function supports nested projects.
 * @param path An added/modified/removed file path from a commit e.g. server-docs/source/index.rst
 * @param commitInfo Contains information
 * @returns
 */
export function getProjectDirFromPath(path: string, snootyDirSet: Set<string>): string {
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

  if (changedFile === SNOOTY_TOML_FILENAME) return pathArray.join('/');

  while (pathArray.length > 0) {
    const currDir = pathArray.join('/');

    if (snootyDirSet.has(currDir)) return currDir;

    pathArray.pop();
  }

  console.warn(`WARNING! No snooty.toml found for the given path: ${path}`);
  return '';
}
