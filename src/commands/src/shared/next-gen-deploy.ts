import { executeAndPipeCommands, executeCliCommand } from '../helpers';

interface NextGenDeployParams {
  mutPrefix: string;
  gitBranch: string;
  hasConfigRedirects: boolean;
  logger: (message: string) => void;
}

/* This is still in development - use with caution */
export async function nextGenDeploy({ mutPrefix, gitBranch, hasConfigRedirects, logger }: NextGenDeployParams) {
  try {
    if (hasConfigRedirects && (gitBranch === 'main' || gitBranch === 'master')) {
      // equivalent to: mut-redirects config/redirects -o public/.htaccess
      await executeCliCommand({ command: 'mut-redirects', args: ['config/redirects', '-o', 'public/.htaccess'] });
      logger(`COMMAND: mut-redirects config/redirects -o public/.htaccess`);
    }

    const bucket = process.env.BUCKET;
    const url = process.env.URL;
    if (!bucket) {
      logger(`nextGenDeploy has failed. Variable for S3 bucket address was undefined.`);
      return {
        status: 'failure',
        output: 'Failed in nextGenDeploy: No value present for S3 bucket',
        error: 'No value present for S3 bucket.',
      };
    }
    if (!url) {
      logger(`nextGenDeploy has failed. Variable for URL address was undefined.`);
      return {
        status: 'failure',
        output: 'Failed in nextGenDeploy: No value present for target url.',
        error: 'No value present for URL.',
      };
    }

    logger(`URL: ${url}\nBUCKET: ${bucket}\n`);

    // equivalent to: yes | mut-publish public ${BUCKET} --prefix=${MUT_PREFIX} --deploy --deployed-url-prefix=${URL} --json --all-subdirectories ${ARGS};
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
    logger(
      `COMMAND: yes | mut-publish public ${bucket} --prefix=${mutPrefix} --deploy --deployed-url-prefix=${url} --json --all-subdirectories ${process.cwd()}/snooty`
    );
    logger(`${outputText}\n Hosted at ${url}/${mutPrefix}`);
    return {
      status: 'inProgress',
      output: outputText,
      error: '',
    };
  } catch (error) {
    logger(`nextGenDeploy has failed.`);
    return {
      status: 'failure',
      output: 'Failed in nextGenDeploy',
      error: error?.message || '',
    };
  }
}
