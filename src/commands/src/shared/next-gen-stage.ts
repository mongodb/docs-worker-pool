import { checkIfPatched, executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '../helpers';

interface StageParams {
  repoDir: string;
  mutPrefix: string;
  projectName: string;
  bucketName: string;
  url: string;
}

export async function nextGenStage({ repoDir, mutPrefix, projectName, bucketName, url }: StageParams) {
  const [hasPatch, commitBranch] = await Promise.all([checkIfPatched(repoDir), getCommitBranch(repoDir)]);

  let hostedAtUrl = `${url}/${mutPrefix}/${process.env.USER}/${commitBranch}/`;

  const commandArgs = ['public', bucketName, '--stage'];

  if (hasPatch && projectName !== mutPrefix) {
    const [commitHash, patchId] = await Promise.all([getCommitHash(repoDir), getPatchId(repoDir)]);
    commandArgs.push(`--prefix="${commitHash}/${patchId}/${mutPrefix}"`);
    hostedAtUrl = `${url}/${commitHash}/${patchId}/${mutPrefix}/${process.env.USER}/${commitBranch}/`;
  }

  const { outputText } = await executeCliCommand({ command: 'mut-publish', args: commandArgs });
  const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}`;
  return resultMessage;
}
