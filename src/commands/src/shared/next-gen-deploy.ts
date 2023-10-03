import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { executeAndPipeCommands, executeCliCommand } from '../helpers';

const existsAsync = promisify(fs.exists);

interface NextGenDeployParams {
  bucket: string;
  mutPrefix: string;
  gitBranch: string;
}

export async function nextGenDeploy({ bucket, mutPrefix, gitBranch }: NextGenDeployParams) {
  const hasConfigRedirects = await existsAsync(path.join(process.cwd(), 'config/redirects'));

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
