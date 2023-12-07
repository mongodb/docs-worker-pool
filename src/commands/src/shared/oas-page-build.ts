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
  console.log('siteUrl: ', siteUrl);
  preppedLogger(`Is there a mutprefix?? : ${job.payload.mutPrefix}`);
  preppedLogger(`SITE URL: ${siteUrl}`);
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const bundlePath = `${repoDir}/bundle.zip`;
  preppedLogger(`BUNDLE PATH ? : ${bundlePath}`);

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

    preppedLogger(`OAS page builder output text? : ${outputText}`);

    return outputText;
  } catch (error) {
    preppedLogger(`Caught error from OAS page builder cli!: ${error}\n\n`);

    return '';
  }
}
