import { executeCliCommand } from '../helpers';
import { Job } from '../../../entities/job';

export async function nextGenHtml({ job, logger }: { job: Job; logger: (msg: string) => void }) {
  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
    logger: logger,
  });
  return result;
}
