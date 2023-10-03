import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { executeAndPipeCommands, executeCliCommand, getCommitBranch, getRepoDir } from '../helpers';

const existsAsync = promisify(fs.exists);

export async function nextGenDeploy({ repoName }) {
  const repoDir = getRepoDir(repoName);

  const [hasConfigRedirects, gitBranch] = await Promise.all([
    existsAsync(path.join(process.cwd(), 'config/redirects')),
    getCommitBranch(repoDir),
  ]);

  if (hasConfigRedirects && (gitBranch === 'main' || gitBranch === 'master')) {
    // mut-redirects config/redirects -o public/.htaccess

    await executeCliCommand({ command: 'mut-redirects', args: ['config/redirects', '-o', 'public/.htaccess'] });
  }

  // yes | mut-publish public ${BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=${URL} --json --all-subdirectories ${ARGS};
  await executeAndPipeCommands(
    { command: 'yes' },
    { command: 'mut-publish', args: ['public', bucket, `--prefix=${mutPrefix}`, '--json', '--all-subdirectories'] }
  );
}
