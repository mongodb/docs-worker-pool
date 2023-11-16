import { CliCommandResponse, executeCliCommand } from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

interface NextGenParseParams {
  repoDir: string;
  commitHash: string;
  patchId?: string;
}
export async function nextGenParse({ repoDir, patchId, commitHash }: NextGenParseParams): Promise<CliCommandResponse> {
  const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`, RSTSPEC_FLAG];

  if (patchId) {
    commandArgs.push('--commit');
    commandArgs.push(commitHash);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }

  return executeCliCommand({ command: 'snooty', args: commandArgs });
}
