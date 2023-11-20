import { Job } from '../../../entities/job';
import { executeCliCommand, getRepoDir } from '../helpers';

interface PersistenceModuleParams {
  job: Job;
  preppedLogger: (message: string) => void;
}
export async function persistenceModule({ job, preppedLogger }: PersistenceModuleParams) {
  const githubUser = job.payload.repoOwner;
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const bundlePath = `${repoDir}/bundle.zip`;

  const args = [
    `${process.cwd()}/modules/persistence/dist/index.js`,
    '--unhandled-rejections=strict',
    '--path',
    bundlePath,
    '--githubUser',
    githubUser,
  ];

  // if (job._id) {
  //   args.push('--jobId');
  //   args.push(job._id);
  // }

  preppedLogger(`persistence args: ${args}`);

  const { outputText } = await executeCliCommand({
    command: 'node',
    args,
  });

  preppedLogger(`output text persistence: ${outputText}`);

  return outputText;
}
