import { Commit } from '@octokit/webhooks-types';
import { getOctokitClient } from '../../clients/githubClient';
import { GitCommitInfo } from '../types/github-types';

export const SNOOTY_TOML_FILENAME = 'snooty.toml';

let snootyDirSet: Set<string>;

/**
 * Creates a `Set` of all `snooty.toml` paths within the monorepo.
 * The function retrieves the monorepo's
 * @returns
 */
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

    const snootyTomlDirs = data.tree
      .filter((treeNode) => !!treeNode.path?.includes(SNOOTY_TOML_FILENAME))
      .map((treeNode) => {
        // casting the `treeNode.path` from `(string | undefined)` to `string` since the filter will ensure that the result
        // only includes treeNode.path values that are defined and include snooty.toml
        // in the path i.e. we will not have `undefined` as a value in the resulting array.
        const path = treeNode.path as string;

        // the - 1 is to remove the trailing slash
        return path.slice(0, path.length - SNOOTY_TOML_FILENAME.length - 1);
      });

    snootyDirSet = new Set(snootyTomlDirs);

    return snootyDirSet;
  } catch (error) {
    console.error(
      `ERROR! Unable to retrieve tree for SHA: ${commitSha} owner name: ${ownerName} repo name: ${repoName}`,
      error
    );
    throw error;
  }
}

export const getUpdatedFilePaths = (commit: Commit): string[] =>
  commit.modified.concat(commit.added).concat(commit.removed);
