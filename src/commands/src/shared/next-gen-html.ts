import { Logger } from 'aws-sdk/lib/config-base';
import path from 'path';
import { executeCliCommand } from '../helpers';

export async function nextGenHtml(repoName: string, logger: Logger) {
  let cwd = path.join(`${process.cwd()}`, `../../../snooty`);
  if (repoName === 'docs-monorepo') {
    cwd = path.join(`${process.cwd()}`, `../../snooty`);
  }

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd },
  });

  return result;
}
