import { Job } from '../../../entities/job';
import { executeCliCommand, getRepoDir } from '../helpers';

const DOCS_WORKER_USER = 'docsworker-xlarge';
interface StageParams {
  job: Job;
  preppedLogger: (message: string) => void;
  bucket: string;
  url: string;
}

export async function nextGenStage({ job, preppedLogger, bucket, url }: StageParams) {
  const { mutPrefix, branchName, patch, project, newHead } = job.payload;

  let prefix = mutPrefix || project;
  // TODO: Figure out correct hostedAtUrl
  let hostedAtUrl = `${url}/${prefix}/${DOCS_WORKER_USER}/${branchName}/`;

  const commandArgs = ['public', bucket, '--stage'];

  if (patch && newHead && project === mutPrefix) {
    prefix = `${newHead}/${patch}/${mutPrefix}`;
    hostedAtUrl = `${url}/${newHead}/${patch}/${mutPrefix}/${DOCS_WORKER_USER}/${branchName}/`;
  }

  commandArgs.push(`--prefix=${prefix}`);

  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  try {
    await executeCliCommand({
      command: 'cp',
      args: ['-r', `${process.cwd()}/snooty/public`, repoDir],
    });

    const { outputText } = await executeCliCommand({
      command: 'mut-publish',
      args: commandArgs,
      options: {
        cwd: repoDir,
      },
      logger: preppedLogger,
    });

    const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}\n\nHere are the commands: ${commandArgs}`;
    preppedLogger(resultMessage);

    return {
      status: 'inProgress',
      output: '', // TODO: better values
      error: '',
    };
  } catch (error) {
    preppedLogger(`Failed in nextGenStage.`);
    return {
      status: 'failure', // Is this a correct value??
      output: '', // TODO: better values
      error: '',
    };
  }
}
