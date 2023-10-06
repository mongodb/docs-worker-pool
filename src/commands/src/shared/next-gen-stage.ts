import { executeCliCommand, getCommitHash, getPatchId } from '../helpers';

interface StageParams {
  repoDir: string;
  mutPrefix: string;
  projectName: string;
  bucket: string;
  url: string;
  patchId?: string;
  commitBranch: string;
}

export async function nextGenStage({
  repoDir,
  mutPrefix,
  projectName,
  bucket,
  url,
  patchId,
  commitBranch,
}: StageParams) {
  let hostedAtUrl = `${url}/${mutPrefix}/docsworker/${commitBranch}/`;
  let prefix = mutPrefix;

  const commandArgs = ['public', bucket, '--stage'];

  if (patchId && projectName === mutPrefix) {
    const [commitHash, patchId] = await Promise.all([getCommitHash(repoDir), getPatchId(repoDir)]);
    prefix = `${commitHash}/${patchId}/${mutPrefix}`;
    hostedAtUrl = `${url}/${commitHash}/${patchId}/${mutPrefix}/docsworker/${commitBranch}/`;
  }

  commandArgs.push(`--prefix="${prefix}"`);

  const { outputText, errorText } = await executeCliCommand({
    command: 'mut-publish',
    args: commandArgs,
    options: {
      cwd: `${process.cwd()}/snooty`,
    },
  });

  console.log(errorText);
  const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}`;
  return resultMessage;
}
