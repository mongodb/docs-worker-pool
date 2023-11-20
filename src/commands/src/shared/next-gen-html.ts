import path from 'path';
import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand } from '../helpers';

export async function nextGenHtml(repoName: string) {
  // let cwd = path.join(`${process.cwd()}`, `../../../snooty`);
  // if (repoName === 'docs-monorepo') {
  //   cwd = path.join(`${process.cwd()}`, `../../snooty`);
  // }

  // logger.save(repoName, `nextGenHtml cwd: ${cwd}`);

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });

  // logger.save(repoName, result)

  return result;
}
