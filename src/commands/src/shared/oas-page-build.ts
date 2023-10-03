import { executeCliCommand } from '../helpers';

interface OasPageBuildParams {
  bundlePath: string;
  repoDir: string;
  siteUrl: string;
}

export async function oasPageBuild({ bundlePath, repoDir, siteUrl }: OasPageBuildParams) {
  const { outputText } = await executeCliCommand({
    command: 'node',
    args: [
      `${process.cwd()}/modules/oas-page-builder/dist/index.js`,
      '--bundle',
      bundlePath,
      '--output',
      `${repoDir}/public`,
      '--redoc',
      `${process.cwd()}/redoc/cli/index.js`,
      '--site-url',
      siteUrl,
    ],
  });

  return outputText;
}
