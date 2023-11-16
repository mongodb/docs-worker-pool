import { Job } from '../../../entities/job';
import { IJobRepoLogger } from '../../../services/logger';
import { executeCliCommand, getRepoDir } from '../helpers';

interface OasPageBuildParams {
  // bundlePath: string;
  // repoDir: string;
  // siteUrl: string;
  job: Job;
  baseUrl: string;
  logger: IJobRepoLogger;
}

export async function oasPageBuild({ job, baseUrl, logger }: OasPageBuildParams) {
  const siteUrl = job.payload.mutPrefix
    ? `${baseUrl}/${job.payload.mutPrefix}`
    : `${baseUrl}/${job.payload.project}/docsworker/${job.payload.branchName}`;
  console.log('siteUrl: ', siteUrl);
  logger.save(job._id, `Is there a mutprefix?? : ${job.payload.mutPrefix}`);
  logger.save(job._id, `SITE URL: ${siteUrl}`);
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const bundlePath = `${repoDir}/bundle.zip`;
  logger.save(job._id, `BUNDLE PATH ? : ${bundlePath}`);

  try {
    const { outputText } = await executeCliCommand({
      command: 'node',
      args: [
        `${process.cwd()}/modules/oas-page-builder/index.js`, // There was a dist/index.js??
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

    logger.save(job._id, `OAS page builder output text? : ${outputText}`);

    return outputText;
  } catch (error) {
    logger.save(job._id, `Caught error from OAS page builder cli!: ${error}\n\n`);

    return '';
  }
}
