import { getSnootyDirSet } from './utils/path-utils';
import { GitCommitInfo } from './types/github-types';
import { getProjectDirFromPath } from './services/get-paths';
import { ConsoleLogger } from '../services/logger';

interface FileUpdatePayload {
  ownerName: string;
  repoName: string;
  commitSha: string;
  updatedFilePaths: string[];
}

/**
 * Retrieves the path of project directories. This is determined
 * by finding the nearest parent directory that has a snooty.toml file
 * for a given updated file path from a commit.
 * @param repoName Name of the repository to check.
 * @param ownerName Name of the owner of the repository.
 * @param commitSha The Git commit SHA that contains the changed files.
 * @param updatedFilePaths An array of all of the changed files (added, removed, modified)
 * from the commit. The method `getUpdatedFilePaths` in the `src/monorepo/utils/path-utils.ts
 * can be used to parse these paths from a GitHub `Commit` object.
 * @returns An array of all the project paths that need to be built.
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
  const projects = updatedFilePaths.map((path) => getProjectDirFromPath(path, snootyDirSet));

  // remove empty strings and remove duplicated values
  return Array.from(new Set(projects.filter((dir) => !!dir)));
}
