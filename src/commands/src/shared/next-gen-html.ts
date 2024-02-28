import { CliCommandResponse, executeCliCommand } from '../helpers';

export async function nextGenHtml(): Promise<CliCommandResponse> {
  try {
    const result = await executeCliCommand({
      command: 'time',
      args: ['-v', 'npm', 'run', 'build'],
      options: { cwd: `${process.cwd()}/snooty` },
    });
    return result;
  } catch (error) {
    throw new Error(`next-gen-html failed. \n ${error}`);
  }
}
