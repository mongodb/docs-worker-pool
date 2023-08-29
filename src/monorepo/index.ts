import { Commit } from '@octokit/webhooks-types';
import { getProjectDirFromPath } from './utils/paths';
import { GitCommitInfo } from './types/github-types';

interface FileUpdatePayload {
  repoName: string;
  ownerName: string;
  commitSha: string;
  updatedFilePaths: string[];
}

export const getUpdatedFilePaths = (commit: Commit): string[] =>
  commit.modified.concat(commit.added).concat(commit.removed);

export async function getMonorepoPaths(fileUpdates: FileUpdatePayload): Promise<string[]> {
  const { repoName, ownerName, commitSha, updatedFilePaths } = fileUpdates;

  const commitInfo: GitCommitInfo = {
    repoName,
    ownerName,
    commitSha,
  };

  const projects = await Promise.all(
    updatedFilePaths.map((path) => getProjectDirFromPath(path, commitInfo)).filter((dir) => !!dir)
  ); // !!dir filters out empty strings

  return Array.from(new Set(projects));
}
