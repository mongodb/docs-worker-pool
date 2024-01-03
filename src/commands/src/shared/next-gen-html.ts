import { CliCommandResponse, executeCliCommand } from '../helpers';

export async function nextGenHtml(): Promise<CliCommandResponse> {
  try {
    return executeCliCommand({
      command: 'npm',
      args: ['run', 'build'],
      options: { cwd: `${process.cwd()}/snooty` },
    });
  } catch (error) {
    return {
      outputText: '',
      errorText: `ERROR: ${error}`,
    };
  }
}
