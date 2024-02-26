import { Job } from '../../../entities/job';
import { CommandExecutorResponse, CommandExecutorResponseStatus } from '../../../services/commandExecutor';
import { executeCliCommand, getRepoDir } from '../helpers';

const DOCS_WORKER_USER = 'docsworker-xlarge';
interface StageParams {
  job: Job;
  bucket?: string;
  url?: string;
}

export async function nextGenStage({ job, bucket, url }: StageParams): Promise<CommandExecutorResponse> {
  const { mutPrefix, branchName, project, newHead, patchId } = job.payload;

  if (!bucket) {
    console.log(`nextGenStage has failed. Variable for S3 bucket address was undefined.`);
    return {
      status: CommandExecutorResponseStatus.failed,
      output: 'Failed in nextGenStage: No value present for S3 bucket',
      error: 'ERROR: No value present for S3 bucket.',
    };
  }
  if (!url) {
    console.log(`nextGenStage has failed. Variable for URL address was undefined.`);
    return {
      status: CommandExecutorResponseStatus.failed,
      output: 'Failed in nextGenStage: No value present for target url.',
      error: 'ERROR: No value present for URL.',
    };
  }

  let prefix = mutPrefix || project;
  let hostedAtUrl = `${url}/${prefix}/${DOCS_WORKER_USER}/${branchName}/`;

  const commandArgs = ['public', bucket, '--stage'];

  if (patchId && newHead && project === mutPrefix) {
    prefix = `${newHead}/${patchId}/${mutPrefix}`;
    hostedAtUrl = `${url}/${newHead}/${patchId}/${mutPrefix}/${DOCS_WORKER_USER}/${branchName}/`;
  }
  prefix = 'testingRelease1';

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

    return {
      status: CommandExecutorResponseStatus.success,
      output: resultMessage,
      error: errorText,
    };
  } catch (error) {
    console.log(`Failed in nextGenStage.`);
    return {
      status: CommandExecutorResponseStatus.failed,
      output: 'Failed in nextGenStage',
      error: 'ERROR: Failed in nextGenStage',
    };
  }
}
