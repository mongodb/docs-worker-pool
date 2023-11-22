import path from 'path';
import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand } from '../helpers';

export async function nextGenHtml(logger: (msg: string) => void) {
  // let cwd = path.join(`${process.cwd()}`, `../../../snooty`);
  // if (repoName === 'docs-monorepo') {
  //   cwd = path.join(`${process.cwd()}`, `../../snooty`);
  // }

  logger(`nextGenHtml cwd: npm run build ${process.cwd()}/snooty`);

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });

  logger(`Result of html: ${result}`);

  return result;
}
