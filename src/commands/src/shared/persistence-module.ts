import { Job } from '../../../entities/job';
import { CliCommandResponse, executeCliCommand, getRepoDir } from '../helpers';

interface PersistenceModuleParams {
  job: Job;
}
export async function persistenceModule({ job }: PersistenceModuleParams): Promise<CliCommandResponse> {
  const githubUser = job.payload.repoOwner;
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const bundlePath = `${repoDir}/bundle.zip`;

  const args = [
    '-v',
    'node',
    `${process.cwd()}/modules/persistence/index.js`,
    '--unhandled-rejections=strict',
    '--path',
    bundlePath,
    '--githubUser',
    githubUser,
  ];

  if (job._id) {
    args.push('--jobId');
    args.push(job._id);
  }

  try {
    const result = await executeCliCommand({
      command: 'time',
      args,
    });

    return result;
  } catch (error) {
    throw new Error(`persistence-module failed. \n ${error}`);
  }
}
