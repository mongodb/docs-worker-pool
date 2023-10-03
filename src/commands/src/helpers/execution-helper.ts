import path from 'path';
import fs from 'fs';
import { checkIfPatched, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);

export async function getCliBuildDependencies(repoName: string) {
  const repoDir = getRepoDir(repoName);
  const commandPromises = [
    checkIfPatched(repoDir),
    getCommitHash(repoDir),
    getCommitBranch(repoDir),
    getPatchId(repoDir),
    existsAsync(path.join(process.cwd(), 'config/redirects')),
  ];

  const deps = await Promise.all(commandPromises);
  return {
    hasPatch: deps[0] as string,
    commitHash: deps[1] as string,
    commitBranch: deps[2] as string,
    patchId: deps[3] as string | undefined,
    hasRedirects: deps[4] as boolean,
    bundlePath: `${repoDir}/bundle.zip`,
  };
}
