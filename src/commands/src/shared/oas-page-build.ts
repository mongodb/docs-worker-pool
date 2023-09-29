import { executeCliCommand } from '../helpers';

interface OasPageBuildParams {
  bundlePath: string;
  repoDir: string;
  siteUrl: string;
}

export async function oasPageBuild({ bundlePath, repoDir, siteUrl }: OasPageBuildParams) {
  const { stdout } = await executeCliCommand({
    command: 'node',
    args: [
      `${process.cwd()}/modules/oas-page-builder/dist/index.js`,
      '--output',
      `${repoDir}/public`,
      '--redoc',
      `${process.cwd()}/redoc/cli/index.js`,
      '--site-url',
      siteUrl,
    ],
  });
}
