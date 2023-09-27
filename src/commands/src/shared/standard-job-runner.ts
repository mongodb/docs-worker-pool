import { getRepoDir, checkIfPatched, getCommitHash, executeCliCommand, getPatchId, RSTSPEC_FLAG } from '../helpers';

export class StandardJobRunner {
  repoName: string;
  repoDir: string;
  project: string;

  constructor(repoName: string, project: string) {
    this.repoName = repoName;
    this.project = project;

    this.repoDir = getRepoDir(repoName);
  }

  async nextGenParse(): Promise<void> {
    const commandArgs = ['build', this.repoDir, '--output', `${this.repoDir}/bundle.zip`, RSTSPEC_FLAG];

    const hasPatch = await checkIfPatched(this.repoDir);

    if (hasPatch) {
      const [patchId, commitHash] = await Promise.all([getPatchId(this.repoDir), getCommitHash(this.repoDir)]);

      commandArgs.push('--commit');
      commandArgs.push(commitHash);

      commandArgs.push('--patch');
      commandArgs.push(patchId);
    }

    await executeCliCommand({ command: 'snooty', args: commandArgs });
  }

  async nextGenHtml() {
    // copy .env.production to the snooty directory
    await executeCliCommand({ command: 'cp', args: [`${this.repoDir}/.env.production`, 'snooty'] });

    await executeCliCommand({ command: 'echo', args: [`"GATSBY_SITE=${this.project}"`] });
  }

  async nextGenDeploy() {
    throw new Error('Not implemented');
  }
}
