import path from 'path';
import { Job } from '../../../entities/job';
import { getDirectory } from '../../../job/jobHandler';
import { CliCommandResponse, ExecuteCommandError, executeCliCommand } from '../helpers';

const SNOOTY_PARSER_VERSION = process.env['SNOOTY_PARSER_VERSION'];
const RSTSPEC_FLAG = `--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/${SNOOTY_PARSER_VERSION}/snooty/rstspec.toml`;
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
    if (error instanceof ExecuteCommandError && error.exitCode !== 1) {
      return error.data as CliCommandResponse;
    }
    throw new Error(`next-gen-parse failed. \n ${error}`);
  }
}
