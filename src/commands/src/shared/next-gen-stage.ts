import { Job } from '../../../entities/job';
import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand, getRepoDir } from '../helpers';

const DOCS_WORKER_USER = 'docsworker-xlarge';
interface StageParams {
  job: Job;
  bucket?: string;
  url?: string;
  logger: IJobRepoLogger;
}

export async function nextGenStage({ job, bucket, url, logger }: StageParams) {
  const { mutPrefix, branchName, patch, project, newHead } = job.payload;

  if (!bucket) {
    console.log(`nextGenStage has failed. Variable for S3 bucket address was undefined.`);
    return {
      status: 'failure',
      output: 'Failed in nextGenStage: No value present for S3 bucket',
      error: 'No value present for S3 bucket.',
    };
  }
  if (!url) {
    console.log(`nextGenStage has failed. Variable for URL address was undefined.`);
    return {
      status: 'failure',
      output: 'Failed in nextGenStage: No value present for target url.',
      error: 'No value present for URL.',
    };
  }

  let prefix = mutPrefix || project;
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

    const { outputText, errorText } = await executeCliCommand({
      command: 'mut-publish',
      args: commandArgs,
      options: {
        cwd: repoDir,
      },
    });

    const resultMessage = `${outputText}\n Hosted at ${hostedAtUrl}\n\nHere are the commands: ${commandArgs}`;
    logger.save(job._id, resultMessage);
    if (errorText) logger.save(job._id, errorText);

    return {
      status: 'success',
      output: outputText,
      error: errorText,
    };
  } catch (error) {
    console.log(`Failed in nextGenStage.`);
    return {
      status: 'failed',
      output: 'Failed in nextGenStage',
      error: 'Failed in nextGenStage',
    };
  }
}
