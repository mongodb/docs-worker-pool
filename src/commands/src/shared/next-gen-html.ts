import path from 'path';
import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand, getRepoDir } from '../helpers';
import { Job } from '../../../entities/job';

export async function nextGenHtml({ job, preppedLogger }: { job: Job; preppedLogger: (msg: string) => void }) {
  // let cwd = path.join(`${process.cwd()}`, `../../../snooty`);
  // if (repoName === 'docs-monorepo') {
  //   cwd = path.join(`${process.cwd()}`, `../../snooty`);
  // }

  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);

  preppedLogger(`Now running first cp command: cp ${repoDir}/.env.production ${repoDir}/snooty`);
  await executeCliCommand({
    command: 'cp',
    args: [`${repoDir}/.env.production`, `${repoDir}/snooty`],
  });

  preppedLogger(`nextGenHtml cwd: npm run build ${process.cwd()}/snooty`);

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });

  preppedLogger(`Result of html: ${result}`);

  preppedLogger(`Now running second cp command: cp -r ${repoDir}/snooty/public ${repoDir}`);
  await executeCliCommand({
    command: 'cp',
    args: [`-r`, `${repoDir}/snooty/public`, `${repoDir}`],
  });

  return result;
}
