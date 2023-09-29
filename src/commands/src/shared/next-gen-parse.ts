import {
  CliCommandResponse,
  checkIfPatched,
  executeCliCommand,
  getCommitHash,
  getPatchId,
  getRepoDir,
} from '../helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

export async function nextGenParse(repoName: string): Promise<CliCommandResponse> {
  const repoDir = getRepoDir(repoName);

  const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`, RSTSPEC_FLAG];

  const hasPatch = await checkIfPatched(repoDir);

  if (hasPatch) {
    const [patchId, commitHash] = await Promise.all([getPatchId(repoDir), getCommitHash(repoDir)]);

    commandArgs.push('--commit');
    commandArgs.push(commitHash);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }

  return executeCliCommand({ command: 'snooty', args: commandArgs });
}
