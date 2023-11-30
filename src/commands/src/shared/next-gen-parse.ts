import { CliCommandResponse, executeCliCommand } from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';
interface NextGenParseParams {
  repoDir: string;
  commitHash: string;
  patchId?: string;
  isProd?: boolean;
}
export async function nextGenParse({
  repoDir,
  patchId,
  commitHash,
  isProd,
}: NextGenParseParams): Promise<CliCommandResponse> {
  const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`, RSTSPEC_FLAG];

  if (patchId) {
    commandArgs.push('--commit');
    commandArgs.push(commitHash);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }

  // Not currently used in production builds, adding functionality
  // now so that it is available when it is.
  if (isProd) {
    commandArgs.push('--no-caching');
  }

  return executeCliCommand({ command: 'snooty', args: commandArgs });
}
