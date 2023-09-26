import { getRepoDir, checkIfPatched, getCommitHash, executeCliCommand, getPatchId, RSTSPEC_FLAG } from '../helpers';

export abstract class BaseJob {
  repoName: string;

  constructor(repoName: string) {
    this.repoName = repoName;
  }

  async nextGenParse(repoName: string): Promise<void> {
    const repoDir = getRepoDir(repoName);

    const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`, RSTSPEC_FLAG];

    const hasPatch = await checkIfPatched(repoDir);

    if (hasPatch) {
      const [patchId, commitHash] = await Promise.all([getPatchId(repoDir), getCommitHash()]);

      commandArgs.push('--commit');
      commandArgs.push(commitHash);

      commandArgs.push('--patch');
      commandArgs.push(patchId);
    }

    await executeCliCommand('snooty', commandArgs);
  }
  async nextGenHtml(repoName: string) {
    getRepoDir(repoName);
  }

  async nextGenDeploy() {
    throw new Error('Not implemented');
  }
}
