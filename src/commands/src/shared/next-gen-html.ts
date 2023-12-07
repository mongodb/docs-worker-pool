import { executeCliCommand } from '../helpers';
import { Job } from '../../../entities/job';

export async function nextGenHtml({ job, preppedLogger }: { job: Job; preppedLogger: (msg: string) => void }) {
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

  // rsync -az --exclude '.git' "${PATH_TO_SNOOTY}" "${REPO_DIR}"
  // const rysnc = await executeCliCommand({
  //   command: 'rsync',
  //   args: [`-az --exclude .git ${process.cwd()}/snooty ${repoDir}`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of rsync: ${rysnc.outputText}\n ${rysnc.errorText}`);

  // preppedLogger(`Now cd into snooty: cd ${process.cwd()}/snooty`);
  // const secondResult = await executeCliCommand({
  //   command: 'cd',
  //   args: [`${process.cwd()}/snooty`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of cd : ${secondResult.outputText}\n ${secondResult.errorText}`);

  // process.chdir(`${process.cwd()}/snooty`);
  // preppedLogger(`new pwd in to snooty? ${process.cwd()}`);

  preppedLogger(`Here is the JOB!!! : ${JSON.stringify(job)}`);

  preppedLogger(`nextGenHtml cwd: npm run build ${process.cwd()}/snooty`);

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
    logger: preppedLogger,
  });

  preppedLogger(`Result of html: ${result.outputText}\n ${result.errorText}`);

  // preppedLogger(`Now running cd ..`);
  // const zoomOut = await executeCliCommand({
  //   command: 'cd',
  //   args: [`..`],
  //   logger: preppedLogger,
  // });

  // process.chdir(`../`);
  // preppedLogger(`new pwd out of snooty? ${process.cwd()}`);

  // await executeCliCommand({
  //   command: 'ls',
  //   options: { cwd: `${process.cwd()}/snooty/public` },
  //   logger: preppedLogger,
  // });

  // await executeCliCommand({
  //   command: 'ls',
  //   options: { cwd: `${process.cwd()}/snooty/public/page-data` },
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Now running second cp command: cp -r ${process.cwd()}/snooty/public ${repoDir}}`);
  // const lastResult = await executeCliCommand({
  //   command: 'cp',
  //   args: [`-r`, `${process.cwd()}/snooty/public`, `${repoDir}`],
  //   logger: preppedLogger,
  // });
  // preppedLogger(`Result of last cp : ${lastResult.outputText}\n ${lastResult.errorText}`);

  return result;
}
