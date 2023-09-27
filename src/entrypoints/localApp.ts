import path from 'path';
import { executeCliCommand, getCommitHash } from '../commands/src/helpers';

async function localApp() {
  const repoDir = path.join(__dirname, '/repos');
  await executeCliCommand({
    command: 'git',
    args: ['clone', 'https://github.com/mongodb/docs-java'],
    options: { cwd: repoDir },
  });
  const gitHash = await getCommitHash(repoDir);

  console.log(gitHash);

  while (true) {}
}

localApp();
