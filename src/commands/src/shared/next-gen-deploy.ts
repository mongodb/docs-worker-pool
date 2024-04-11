import { CommandExecutorResponse, CommandExecutorResponseStatus } from '../../../services/commandExecutor';
import { executeAndPipeCommands, executeCliCommand } from '../helpers';

interface NextGenDeployParams {
  mutPrefix: string;
  gitBranch: string;
  hasConfigRedirects: boolean;
  bucket: string;
  url: string;
}

/* This is still in development - use with caution */
/* Logs here for future debugging purposes */
export async function nextGenDeploy({
  mutPrefix,
  gitBranch,
  hasConfigRedirects,
  bucket,
  url,
}: NextGenDeployParams): Promise<CommandExecutorResponse> {
  try {
    if (hasConfigRedirects && (gitBranch === 'main' || gitBranch === 'master')) {
      // equivalent to: mut-redirects config/redirects -o public/.htaccess
      await executeCliCommand({ command: 'mut-redirects', args: ['config/redirects', '-o', 'public/.htaccess'] });
      console.log(`COMMAND: mut-redirects config/redirects -o public/.htaccess`);
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
          '--dry-run',
        ],
        options: {
          cwd: `${process.cwd()}/snooty`,
        },
      }
    );
    console.log(
      `COMMAND: yes | mut-publish public ${bucket} --prefix=${mutPrefix} --deploy --deployed-url-prefix=${url} --json --all-subdirectories --dry-run`
    );
    console.log(`${outputText}\n Hosted at ${url}${mutPrefix}`);
    return {
      status: CommandExecutorResponseStatus.success,
      output: outputText,
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
