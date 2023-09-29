import { checkIfPatched, executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '../helpers';

interface StageParams {
  repoName: string;
  mutPrefix: string;
  projectName: string;
  bucketName: string;
  url: string;
}

export async function nextGenStage({ repoName, mutPrefix, projectName, bucketName, url }: StageParams) {
  const repoDir = getRepoDir(repoName);

  const [hasPatch, commitBranch] = await Promise.all([checkIfPatched(repoDir), getCommitBranch(repoDir)]);

  let hostedAtUrl = `${url}/${mutPrefix}/${process.env.USER}/${commitBranch}/`;

  const commandArgs = ['public', bucketName, '--stage'];

  if (hasPatch && projectName !== mutPrefix) {
    const [commitHash, patchId] = await Promise.all([getCommitHash(repoDir), getPatchId(repoDir)]);
    commandArgs.push(`--prefix="${commitHash}/${patchId}/${mutPrefix}"`);
    hostedAtUrl = `${url}/${commitHash}/${patchId}/${mutPrefix}/${process.env.USER}/${commitBranch}/`;
  }

  const { stdout } = await executeCliCommand({ command: 'mut-publish', args: commandArgs });
  const resultMessage = `${stdout}\n Hosted at ${hostedAtUrl}`;
  return resultMessage;
}
