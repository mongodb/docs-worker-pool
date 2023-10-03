import { executeAndPipeCommands, executeCliCommand } from '../helpers';

interface NextGenDeployParams {
  bucket: string;
  mutPrefix: string;
  gitBranch: string;
  hasConfigRedirects: boolean;
}

export async function nextGenDeploy({ bucket, mutPrefix, gitBranch, hasConfigRedirects }: NextGenDeployParams) {
  // const hasConfigRedirects = await existsAsync(path.join(process.cwd(), 'config/redirects'));

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
