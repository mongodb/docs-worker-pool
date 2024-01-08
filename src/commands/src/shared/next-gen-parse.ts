import path from 'path';
import { Job } from '../../../entities/job';
import { getDirectory } from '../../../job/jobHandler';
import { CliCommandResponse, executeCliCommand } from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';
interface NextGenParseParams {
  job: Job;
  patchId?: string;
  isProd?: boolean;
}
export async function nextGenParse({ job, patchId, isProd }: NextGenParseParams): Promise<CliCommandResponse> {
  const repoDir = path.resolve(process.cwd(), `repos/${getDirectory(job)}`);
  const commitHash = job.payload.newHead;

  const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`];

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
    const result = await executeCliCommand({
      command: 'snooty',
      args: commandArgs,
      options: { cwd: repoDir },
    });
    return result;
  } catch (error) {
    throw new Error(`next-gen-parse failed. \n ${error}`);
  }
}
