import {
  checkIfPatched,
  executeAndWriteToFile,
  executeCliCommand,
  getCommitBranch,
  getCommitHash,
  getPatchId,
} from '../helpers';

interface StageParams {
  repoDir: string;
  mutPrefix: string;
  projectName: string;
  bucketName: string;
  url: string;
}

export async function nextGenStage({ repoDir, mutPrefix, projectName, bucketName, url }: StageParams) {
  const [hasPatch, commitBranch] = await Promise.all([checkIfPatched(repoDir), getCommitBranch(repoDir)]);

  let hostedAtUrl = `${url}/${mutPrefix}/docsworker/${commitBranch}/`;
  let prefix = mutPrefix;

  const commandArgs = ['public', bucketName, '--stage'];

  if (hasPatch && projectName === mutPrefix) {
    const [commitHash, patchId] = await Promise.all([getCommitHash(repoDir), getPatchId(repoDir)]);
    prefix = `${commitHash}/${patchId}/${mutPrefix}`;
    hostedAtUrl = `${url}/${commitHash}/${patchId}/${mutPrefix}/docsworker/${commitBranch}/`;
  }

  commandArgs.push(`--prefix="${prefix}"`);

  const { outputText } = await executeCliCommand({
    command: 'mut-publish',
    args: commandArgs,
    options: {
      cwd: `${process.cwd()}/snooty`,
    },
  });
  const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}`;
  return resultMessage;
}
