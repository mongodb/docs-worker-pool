import { executeCliCommand } from '../helpers';

interface PersistenceModuleParams {
  bundlePath: string;
  jobId?: string;
  repoOwner?: string;
}
export async function persistenceModule({
  bundlePath,
  jobId,
  repoOwner = 'docs-builder-bot',
}: PersistenceModuleParams) {
  const args = [
    `${process.cwd()}/modules/persistence/dist/index.js`,
    '--unhandled-rejections=strict',
    '--path',
    bundlePath,
    '--githubUser',
    repoOwner,
  ];

  if (jobId) {
    args.push('--jobId');
    args.push(jobId);
  }

  const { outputText } = await executeCliCommand({
    command: 'node',
    args,
  });

  return outputText;
}
