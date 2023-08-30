import { getSnootyDirSet } from './utils/path-utils';
import { GitCommitInfo } from './types/github-types';
import { getProjectDirFromPath } from './services/get-paths';

interface FileUpdatePayload {
  ownerName: string;
  repoName: string;
  commitSha: string;
  updatedFilePaths: string[];
}

/**
 * Retr
 * @param fileUpdates
 * @returns
 */
export async function getMonorepoPaths({
  repoName,
  ownerName,
  commitSha,
  updatedFilePaths,
}: FileUpdatePayload): Promise<string[]> {
  const commitInfo: GitCommitInfo = {
    ownerName,
    repoName,
    commitSha,
  };

  const snootyDirSet = await getSnootyDirSet(commitInfo);

  // const projects = await Promise.all(updatedFilePaths.map((path) => getProjectDirFromPath(path, commitInfo)));
  const projects = updatedFilePaths.map((path) => getProjectDirFromPath(path, snootyDirSet));

  // remove empty strings and remove duplicated values
  return Array.from(new Set(projects.filter((dir) => !!dir)));
}
