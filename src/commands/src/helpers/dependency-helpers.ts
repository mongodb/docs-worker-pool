import path from 'path';
import fs from 'fs';
import { executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { promisify } from 'util';
import { BuildDependencies } from '../../../entities/job';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);

async function createEnvProdFile({
  repoDir,
  projectName,
  baseUrl,
  prefix = '',
  patchId,
  commitHash,
}: {
  repoDir: string;
  projectName: string;
  baseUrl: string;
  prefix?: string;
  patchId?: string;
  commitHash?: string;
}) {
  const prodFileName = `${process.cwd()}/snooty/.env.production`;

  try {
    await writeFileAsync(
      prodFileName,
      `GATSBY_SITE=${projectName}
      GATSBY_MANIFEST_PATH=${repoDir}/bundle.zip
      GATSBY_PARSER_USER=${process.env.USER ?? 'docsworker-xlarge'}
      GATSBY_BASE_URL=${baseUrl}
      GATSBY_MARIAN_URL=${process.env.GATSBY_MARIAN_URL}
      PATH_PREFIX=${prefix}
      ${patchId ? `PATCH_ID=${patchId}` : ''}
      ${commitHash ? `COMMIT_HASH=${commitHash}` : ''}`,
      'utf8'
    );
  } catch (e) {
    console.error(`ERROR! Could not write to .env.production: ${e}`);
    throw e;
  }
}

export async function downloadBuildDependencies(
  buildDependencies: BuildDependencies,
  repoName: string,
  directory?: string
) {
  const commands: string[] = [];
  await Promise.all(
    buildDependencies.map(async (dependencyInfo) => {
      const repoDir = getRepoDir(repoName, directory);
      const targetDir = dependencyInfo.targetDir ?? repoDir;
      let options = {};
      if (targetDir != repoDir) {
        options = { cwd: repoDir };
      }
      try {
        await executeCliCommand({
          command: 'mkdir',
          args: ['-p', targetDir],
          options: options,
        });
      } catch (error) {
        console.error(
          `ERROR! Could not create target directory ${targetDir}. Dependency information: `,
          dependencyInfo
        );
        throw error;
      }
      commands.push(`mkdir -p ${targetDir}`);
      await Promise.all(
        dependencyInfo.dependencies.map(async (dep) => {
          commands.push(`curl -SfL ${dep.url} -o ${targetDir}/${dep.filename}`);
          try {
            return await executeCliCommand({
              command: 'curl',
              args: ['--max-time', '10', '-SfL', dep.url, '-o', `${targetDir}/${dep.filename}`],
              options: options,
            });
          } catch (error) {
            console.error(
              `ERROR! Could not curl ${dep.url} into ${targetDir}/${dep.filename}. Dependency information: `,
              dependencyInfo
            );
          }
        })
      );
    })
  );
  return commands;
}

export async function prepareBuild(repoName: string, projectName: string, baseUrl: string, directory?: string) {
  const repoDir = getRepoDir(repoName, directory);

  // doing these in parallel
  const commandPromises = [
    getCommitHash(repoDir),
    getCommitBranch(repoDir),
    getPatchId(repoDir),
    existsAsync(path.join(process.cwd(), 'config/redirects')),
  ];

  try {
    const dependencies = await Promise.all(commandPromises);
    await createEnvProdFile({
      repoDir,
      projectName,
      baseUrl,
      commitHash: dependencies[1] as string | undefined,
      patchId: dependencies[2] as string | undefined,
    });

    return {
      commitHash: dependencies[0] as string,
      commitBranch: dependencies[1] as string,
      patchId: dependencies[2] as string | undefined,
      hasRedirects: dependencies[3] as boolean,
      bundlePath: `${repoDir}/bundle.zip`,
      repoDir,
    };
  } catch (error) {
    console.error(`Error: Could not get build deps: ${error}`);
    throw error;
  }
}
