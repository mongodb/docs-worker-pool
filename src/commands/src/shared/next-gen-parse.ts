import { IJobRepoLogger } from '../../../services/logger';
import { CliCommandResponse, executeCliCommand } from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

interface NextGenParseParams {
  repoDir: string;
  commitHash?: string;
  patchId?: string;
  logger: IJobRepoLogger;
  id: string;
}
export async function nextGenParse({
  repoDir,
  patchId,
  commitHash,
  logger,
  id,
}: NextGenParseParams): Promise<CliCommandResponse> {
  const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`, RSTSPEC_FLAG];

  if (patchId && commitHash) {
    commandArgs.push('--commit');
    commandArgs.push(commitHash);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }

  logger.save(id, `COMMAND for parse: ${commandArgs.join(' ')}`);

  return executeCliCommand({ command: 'snooty', args: commandArgs });
}
