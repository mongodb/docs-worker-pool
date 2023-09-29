import { checkIfPatched, executeCliCommand, getCommitHash, getPatchId, getRepoDir } from '../helpers';

interface StageParams {
  repoName: string;
  mutPrefix: string;
  projectName: string;
  bucketName: string;
}

export async function nextGenStage({ repoName, mutPrefix, projectName, bucketName }: StageParams) {
  const repoDir = getRepoDir(repoName);

  const hasPatch = await checkIfPatched(repoDir);

  const commandArgs = ['public', bucketName, '--stage'];

  if (hasPatch && projectName !== mutPrefix) {
    const [commitHash, patchId] = await Promise.all([getCommitHash(repoDir), getPatchId(repoDir)]);
    commandArgs.push(`--prefix="${commitHash}/${patchId}/${mutPrefix}"`);
  }

  const result = await executeCliCommand({ command: 'mut-publish', args: commandArgs });

  return result;
}
