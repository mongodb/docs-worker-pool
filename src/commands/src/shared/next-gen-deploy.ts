import { executeAndPipeCommands, executeCliCommand } from '../helpers';

interface NextGenDeployParams {
  bucket: string;
  mutPrefix: string;
  gitBranch: string;
  hasConfigRedirects: boolean;
  url: string;
}

export async function nextGenDeploy({ bucket, mutPrefix, gitBranch, hasConfigRedirects, url }: NextGenDeployParams) {
  // const hasConfigRedirects = await existsAsync(path.join(process.cwd(), 'config/redirects'));

  if (hasConfigRedirects && (gitBranch === 'main' || gitBranch === 'master')) {
    // mut-redirects config/redirects -o public/.htaccess
    await executeCliCommand({ command: 'mut-redirects', args: ['config/redirects', '-o', 'public/.htaccess'] });
  }

  // yes | mut-publish public ${BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=${URL} --json --all-subdirectories ${ARGS};
  const { outputText } = await executeAndPipeCommands(
    { command: 'yes' },
    {
      command: 'mut-publish',
      args: [
        'public',
        bucket,
        `--prefix=${mutPrefix}`,
        '--deploy',
        `--deployed-url-prefix=${url}`,
        '--json',
        '--all-subdirectories',
      ],
      options: {
        cwd: `${process.cwd()}/snooty`,
      },
    }
  );

  return `${outputText}\n Hosted at ${url}/${mutPrefix}`;
}
