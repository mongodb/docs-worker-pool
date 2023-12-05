import path from 'path';
// import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand, getRepoDir } from '../helpers';
import { Job } from '../../../entities/job';

export async function nextGenHtml({ job, preppedLogger }: { job: Job; preppedLogger: (msg: string) => void }) {
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const reposDir = path.join(process.cwd(), `/repos`);

  // preppedLogger(`Now running first cp command: cp ${repoDir}/snooty/.env.production ${process.cwd()}/snooty`);
  // const firstResult = await executeCliCommand({
  //   command: 'cp',
  //   args: [`${repoDir}/.env.production`, `${process.cwd()}/snooty`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of cp : ${firstResult.outputText}\n ${firstResult.errorText}`);

  const lsResult = await executeCliCommand({
    command: 'ls',
    // args: [`${process.cwd()}/snooty`],
    logger: preppedLogger,
  });
  preppedLogger(`Result of lsResult: ${lsResult.outputText}\n ${lsResult.errorText}`);

  const pwd = await executeCliCommand({
    command: 'pwd',
    // args: [`${process.cwd()}/snooty`],
    logger: preppedLogger,
  });
  preppedLogger(`Result of pwd: ${pwd.outputText}\n ${pwd.errorText}`);

  // preppedLogger(`Now cd into snooty: cd ${process.cwd()}/snooty`);
  // const secondResult = await executeCliCommand({
  //   command: 'cd',
  //   args: [`${process.cwd()}/snooty`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of cd : ${secondResult.outputText}\n ${secondResult.errorText}`);

  process.chdir(`${process.cwd()}/snooty`);
  preppedLogger(`new pwd in to snooty? ${process.cwd()}`);

  preppedLogger(`Here is the JOB!!! : ${JSON.stringify(job)}`);

  preppedLogger(`nextGenHtml cwd: npm run build ${process.cwd()}/snooty`);

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    // options: { cwd: `${process.cwd()}/snooty` },
    logger: preppedLogger,
  });

  preppedLogger(`Result of html: ${result.outputText}\n ${result.errorText}`);

  // preppedLogger(`Now running cd ..`);
  // const zoomOut = await executeCliCommand({
  //   command: 'cd',
  //   args: [`..`],
  //   logger: preppedLogger,
  // });

  process.chdir(`../`);
  preppedLogger(`new pwd out of snooty? ${process.cwd()}`);

  preppedLogger(`Now running second cp command: cp -r ${process.cwd()}/snooty/public ${repoDir}}`);
  const lastResult = await executeCliCommand({
    command: 'cp',
    args: [`-r`, `${process.cwd()}/snooty/public`, `${repoDir}`],
    logger: preppedLogger,
  });
  preppedLogger(`Result of last cp : ${lastResult.outputText}\n ${lastResult.errorText}`);

  return result;
}
