import { Job } from '../../../entities/job';
import { executeCliCommand } from '../helpers';

const DOCS_WORKER_USER = 'docsworker-xlarge';
interface StageParams {
  job: Job;
  preppedLogger: (message: string) => void;
}

export async function nextGenStage({ job, preppedLogger }: StageParams) {
  // TODO: replace with a process to get this url??
  const baseUrl = 'https://mongodbcom-cdn.website.staging.corp.mongodb.com';
  // TODO: replace with process to access bucket
  const bucket = 'docs-atlas-dotcomstg';
  const { mutPrefix, branchName, patch, project, newHead } = job.payload;

  // TODO: Figure out correct hostedAtUrl
  let hostedAtUrl = `${baseUrl}/${mutPrefix}/${DOCS_WORKER_USER}/${branchName}/`;
  // TODO: Look further into all possible needs for prefix...
  let prefix = mutPrefix || project;

  const commandArgs = ['public', bucket, '--stage'];

  if (patch && newHead && project === mutPrefix) {
    prefix = `${newHead}/${patch}/${mutPrefix}`;
    hostedAtUrl = `${baseUrl}/${newHead}/${patch}/${mutPrefix}/${DOCS_WORKER_USER}/${branchName}/`;
  }

  commandArgs.push(`--prefix=${prefix}`);

  preppedLogger(`MUT PUBLISH command args: ${commandArgs}`);

  const { outputText } = await executeCliCommand({
    command: 'mut-publish',
    args: commandArgs,
    options: {
      cwd: `${process.cwd()}/snooty`,
    },
  });

  const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}\n\nHere are the commands: ${commandArgs}`;
  preppedLogger(`OUTPUT of mut publish: ${resultMessage}`);

  return {
    resultMessage,
    commands: commandArgs,
  };
  // return resultMessage;
}
