import { CliCommandResponse, executeCliCommand } from '../helpers';

export async function nextGenHtml(): Promise<CliCommandResponse> {
  return executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });
}
