import { executeCliCommand } from '../helpers';

export async function nextGenHtml() {
  return executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });
}
