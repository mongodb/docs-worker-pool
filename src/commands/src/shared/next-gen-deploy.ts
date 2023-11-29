import { executeAndPipeCommands, executeCliCommand } from '../helpers';

interface NextGenDeployParams {
  // bucket: string;
  mutPrefix: string;
  gitBranch: string;
  hasConfigRedirects: boolean;
  // url: string;
  preppedLogger: (message: string) => void;
}

export async function nextGenDeploy({
  // bucket,
  mutPrefix,
  gitBranch,
  hasConfigRedirects,
  // url,
  preppedLogger,
}: NextGenDeployParams) {
  try {
    if (hasConfigRedirects && (gitBranch === 'main' || gitBranch === 'master')) {
      // equivalent to: mut-redirects config/redirects -o public/.htaccess
      await executeCliCommand({ command: 'mut-redirects', args: ['config/redirects', '-o', 'public/.htaccess'] });
    }

    const bucket = process.env.BUCKET;
    const url = process.env.URL;
    if (!bucket) {
      preppedLogger(`nextGenDeploy has failed. Variable for S3 bucket address was undefined.`);
      return {
        status: 'failure',
        output: 'Failed in nextGenDeploy: No value present for S3 bucket',
        error: 'No value present for S3 bucket.',
      };
    }
    if (!url) {
      preppedLogger(`nextGenDeploy has failed. Variable for URL address was undefined.`);
      return {
        status: 'failure',
        output: 'Failed in nextGenDeploy: No value present for target url.',
        error: 'No value present for URL.',
      };
    }

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
    preppedLogger(`${outputText}\n Hosted at ${url}/${mutPrefix}`);
    return {
      status: 'inProgress',
      output: outputText,
      error: '',
    };
  } catch (error) {
    preppedLogger(`nextGenDeploy has failed.`);
    return {
      status: 'failure',
      output: 'Failed in nextGenDeploy',
      error: error?.message || '',
    };
  }
}
