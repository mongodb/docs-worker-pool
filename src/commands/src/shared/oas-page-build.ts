import { Job } from '../../../entities/job';
import { executeCliCommand, getRepoDir } from '../helpers';

interface OasPageBuildParams {
  job: Job;
  preppedLogger: (message: string) => void;
}

export async function oasPageBuild({ job, preppedLogger }: OasPageBuildParams) {
  // TODO: replace with a process to get this url??
  const baseUrl = 'https://mongodbcom-cdn.website.staging.corp.mongodb.com';

  const siteUrl = job.payload.mutPrefix
    ? `${baseUrl}/${job.payload.mutPrefix}`
    : `${baseUrl}/${job.payload.project}/docsworker-xlarge/${job.payload.branchName}`;
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const bundlePath = `${repoDir}/bundle.zip`;

  try {
    const { outputText } = await executeCliCommand({
      command: 'node',
      args: [
        `${process.cwd()}/modules/oas-page-builder/index.js`, // There was a Fix dist/index.js (dist needed for local, not for staging)
        '--bundle',
        bundlePath,
        '--output',
        `${repoDir}/public`,
        '--redoc',
        `${process.cwd()}/redoc/cli/index.js`,
        '--repo',
        repoDir,
        '--site-url',
        siteUrl,
      ],
    });

    preppedLogger(outputText);

    return outputText;
  } catch (error) {
    preppedLogger(`ERROR: oas-page-build.ts - ${error}`);
    return '';
  }
}
