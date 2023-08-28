import { Commit } from '@octokit/webhooks-types';
import { getProjectDirFromPath } from './utils/paths';

export async function getMonorepoPaths(commit: Commit): Promise<string[]> {
  // Commits will be strings that look like drivers/node/source/index.rst for example
  const commitChanges = commit.modified.concat(commit.added).concat(commit.removed);
  const projects = await Promise.all(commitChanges.map((path) => getProjectDirFromPath(path)).filter((dir) => !!dir)); // !!dir filters out empty strings

  return Array.from(new Set(projects));
}
