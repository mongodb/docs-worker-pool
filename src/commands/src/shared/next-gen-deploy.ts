import { CommandExecutorResponse, CommandExecutorResponseStatus } from '../../../services/commandExecutor';
import { executeAndPipeCommands, executeCliCommand } from '../helpers';

interface NextGenDeployParams {
  branchName: string;
  hasConfigRedirects: boolean;
  mutPrefix?: string | null;
  bucket?: string;
  url?: string;
}

/* This is still in development - use with caution */
/* Logs here for future debugging purposes */
export async function nextGenDeploy({
  mutPrefix,
  branchName,
  hasConfigRedirects,
  bucket,
  url,
}: NextGenDeployParams): Promise<CommandExecutorResponse> {
  try {
    if (hasConfigRedirects && (branchName === 'main' || branchName === 'master' || branchName === 'current')) {
      // equivalent to: mut-redirects config/redirects -o public/.htaccess
      await executeCliCommand({ command: 'mut-redirects', args: ['config/redirects', '-o', 'public/.htaccess'] });
      console.log(`COMMAND: mut-redirects config/redirects -o public/.htaccess`);
    }

    if (!bucket) {
      console.log(`nextGenStage has failed. Variable for S3 bucket address was undefined.`);
      return {
        status: CommandExecutorResponseStatus.failed,
        output: 'Failed in nextGenStage: No value present for S3 bucket',
        error: 'ERROR: No value present for S3 bucket.',
      };
    }
    if (!url) {
      console.log(`nextGenStage has failed. Variable for URL address was undefined.`);
      return {
        status: CommandExecutorResponseStatus.failed,
        output: 'Failed in nextGenStage: No value present for target url.',
        error: 'ERROR: No value present for URL.',
      };
    }

    // equivalent to: yes | mut-publish public ${BUCKET} --prefix=${MUT_PREFIX} --deploy --deployed-url-prefix=${URL} --json --all-subdirectories ${ARGS};
    const { outputText, errorText } = await executeAndPipeCommands(
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
          '--dry-run',
        ],
        options: {
          cwd: `${process.cwd()}/snooty`,
        },
      }
    );
    const output = `COMMAND: yes | mut-publish public ${bucket} --prefix=${mutPrefix} --deploy --deployed-url-prefix=${url} --json --all-subdirectories --dry-run
      \n${outputText} \n ${errorText} \n Hosted at ${url}/${mutPrefix}
    `;

    console.log(output);
    return {
      status: CommandExecutorResponseStatus.success,
      output,
      error: '',
    };
  } catch (error) {
    console.log(`nextGenDeploy has failed.`);
    return {
      status: CommandExecutorResponseStatus.failed,
      output: 'Failed in nextGenDeploy',
      error: error?.message || '',
    };
  }
}
