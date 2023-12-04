import path from 'path';
// import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand, getRepoDir } from '../helpers';
import { Job } from '../../../entities/job';

export async function nextGenHtml({ job, preppedLogger }: { job: Job; preppedLogger: (msg: string) => void }) {
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const reposDir = path.join(process.cwd(), `/repos`);

  // preppedLogger(`Now running first cp command: cp ${repoDir}/.env.production ${repoDir}/snooty`);
  // const firstResult = await executeCliCommand({
  //   command: 'cp',
  //   args: [`${repoDir}/.env.production`, `${repoDir}/snooty`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of cp : ${firstResult.outputText}\n ${firstResult.errorText}`);

  // preppedLogger(`Now cd into snooty`);
  // const secondResult = await executeCliCommand({
  //   command: 'cd',
  //   args: [`snooty`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of cd : ${secondResult.outputText}\n ${secondResult.errorText}`);

  preppedLogger(`Here is the JOB!!! : ${JSON.stringify(job)}`);

  preppedLogger(`nextGenHtml cwd: npm run build ${process.cwd()}/snooty`);

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
    logger: preppedLogger,
  });

  preppedLogger(`Result of html: ${result.outputText}\n ${result.errorText}`);

  // preppedLogger(`Now running second cp command: cp -r ${repoDir}/snooty/public ${repoDir}}`);
  // const lastResult = await executeCliCommand({
  //   command: 'cp',
  //   args: [`-r`, `${repoDir}/snooty/public`, `${repoDir}`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of last cp : ${lastResult.outputText}\n ${lastResult.errorText}`);

  return result;
}
