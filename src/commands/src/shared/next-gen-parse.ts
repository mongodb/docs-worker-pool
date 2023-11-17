import path from 'path';
import { Job } from '../../../entities/job';
import { getDirectory } from '../../../job/jobHandler';
import { CliCommandResponse, executeCliCommand } from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

interface NextGenParseParams {
  job: Job;
  preppedLogger: (message: string) => void;
}
export async function nextGenParse({ job, preppedLogger }: NextGenParseParams): Promise<CliCommandResponse> {
  const repoDir = path.resolve(process.cwd(), `repos/${getDirectory(job)}`);
  const commitHash = job.payload.newHead;
  const patchId = job.payload.patch;

  const commandArgs = ['build', `"${repoDir}"`, '--output', `"${repoDir}/bundle.zip"`];

  if (patchId && commitHash) {
    commandArgs.push('--commit');
    commandArgs.push(commitHash);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }

  commandArgs.push(RSTSPEC_FLAG);

  preppedLogger(`COMMAND for parse: ${commandArgs.join(' ')}`);

  try {
    await executeCliCommand({ command: 'snooty', args: commandArgs });
  } catch (error) {
    preppedLogger(`ERROR: ${error}\n\n`);
  }
}
