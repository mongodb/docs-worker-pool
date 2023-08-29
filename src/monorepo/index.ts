import { Commit } from '@octokit/webhooks-types';
import { getProjectDirFromPath } from './utils/paths';
import { GitCommitInfo } from './types/github-types';

interface FileUpdatePayload {
  repoName: string;
  ownerName: string;
  commitSha: string;
  updatedFilePaths: string[];
}

export async function getMonorepoPaths(fileUpdates: FileUpdatePayload): Promise<string[]> {
  const { repoName, ownerName, commitSha, updatedFilePaths } = fileUpdates;

  const commitInfo: GitCommitInfo = {
    repoName,
    ownerName,
    commitSha,
  };

  const projects = await Promise.all(updatedFilePaths.map((path) => getProjectDirFromPath(path, commitInfo))); // !!dir filters out empty strings
  // remove empty strings and remove duplicated values
  return Array.from(new Set(projects.filter((dir) => !!dir)));
}
