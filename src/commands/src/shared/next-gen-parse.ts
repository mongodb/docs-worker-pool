import path from 'path';
import { Job } from '../../../entities/job';
import { getDirectory } from '../../../job/jobHandler';
import { executeCliCommand } from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';
interface NextGenParseParams {
  job: Job;
  logger: (message: string) => void;
  isProd?: boolean;
}
export async function nextGenParse({ job, logger, isProd }: NextGenParseParams): Promise<any> {
  const repoDir = path.resolve(process.cwd(), `repos/${getDirectory(job)}`);
  const commitHash = job.payload.newHead;
  const patchId = job.payload.patch;

  const commandArgs = ['build', `${repoDir}`, '--output', `${repoDir}/bundle.zip`];

  if (patchId && commitHash) {
    commandArgs.push('--commit');
    commandArgs.push(commitHash);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }
  commandArgs.push(RSTSPEC_FLAG);

  // Not currently used in production builds, adding functionality
  // now so that it is available when it is.
  if (isProd) {
    commandArgs.push('--no-caching');
  }

  try {
    return await executeCliCommand({
      command: 'snooty',
      args: commandArgs,
      options: { cwd: repoDir },
      logger: logger,
    });
  } catch (error) {
    logger(`ERROR: ${error}\n\n`);
  }
}
