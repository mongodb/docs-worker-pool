import { Job } from '../../../entities/job';
import { executeCliCommand, getRepoDir } from '../helpers';

interface OasPageBuildParams {
  job: Job;
  baseUrl: string;
}

export async function oasPageBuild({ job, baseUrl }: OasPageBuildParams) {
  const siteUrl = job.payload.mutPrefix
    ? `${baseUrl}/${job.payload.mutPrefix}`
    : `${baseUrl}/${job.payload.project}/docsworker-xlarge/${job.payload.branchName}`;
  const repoDir = getRepoDir(job.payload.repoName, job.payload.directory);
  const bundlePath = `${repoDir}/bundle.zip`;

  try {
    return await executeCliCommand({
      command: 'node',
      args: [
        `${process.cwd()}/modules/oas-page-builder/index.js`,
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
  } catch (error) {
    return {
      outputText: '',
      errorText: `ERROR: oas-page-build.ts - ${error}`,
    };
  }
}
