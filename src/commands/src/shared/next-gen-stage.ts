import { executeCliCommand } from '../helpers';

const DOCS_WORKER_USER = 'docsworker';
interface StageParams {
  repoDir: string;
  mutPrefix: string;
  projectName: string;
  bucket: string;
  url: string;
  patchId?: string;
  commitBranch: string;
  commitHash: string;
}

export async function nextGenStage({
  mutPrefix,
  projectName,
  bucket,
  url,
  patchId,
  commitBranch,
  commitHash,
}: StageParams) {
  let hostedAtUrl = `${url}/${mutPrefix}/${DOCS_WORKER_USER}/${commitBranch}/`;
  let prefix = mutPrefix;

  const commandArgs = ['public', bucket, '--stage'];

  if (patchId && projectName === mutPrefix) {
    prefix = `${commitHash}/${patchId}/${mutPrefix}`;
    hostedAtUrl = `${url}/${commitHash}/${patchId}/${mutPrefix}/${DOCS_WORKER_USER}/${commitBranch}/`;
  }

  commandArgs.push(`--prefix=${prefix}`);

  const { outputText } = await executeCliCommand({
    command: 'mut-publish',
    args: commandArgs,
    options: {
      cwd: `${process.cwd()}/snooty`,
    },
  });

  const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}\n\nHere are the commands: ${commandArgs}`;
  return {
    resultMessage,
    commands: commandArgs,
  };
  // return resultMessage;
}
