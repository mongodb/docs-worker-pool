import { executeCliCommand } from '../helpers';

export async function nextGenHtml() {
  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });

  return result;
}
