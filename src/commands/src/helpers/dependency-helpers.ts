import path from 'path';
import fs from 'fs';
import { executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { promisify } from 'util';
import { BuildDependencies } from '../../../entities/job';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);

async function cloneRepo(repoName: string) {
  await executeCliCommand({
    command: 'git',
    args: ['clone', `https://github.com/mongodb/${repoName}`],
    options: { cwd: `${process.cwd()}/repos` },
  });
}
async function createEnvProdFile(repoDir: string, projectName: string, baseUrl: string, prefix = '') {
  const prodFileName = `${process.cwd()}/snooty/.env.production`;

  try {
    await writeFileAsync(
      prodFileName,
      `GATSBY_SITE=${projectName}
      GATSBY_MANIFEST_PATH=${repoDir}/bundle.zip
      GATSBY_PARSER_USER=${process.env.USER}
      GATSBY_BASE_URL=${baseUrl}
      GATSBY_MARIAN_URL=${process.env.GATSBY_MARIAN_URL}
      PATH_PREFIX=${prefix}`,
      'utf8'
    );
  } catch (e) {
    console.error(`ERROR! Could not write to .env.production`);
    throw e;
  }
}

export async function downloadBuildDependencies(buildDependencies: BuildDependencies | null, repoName: string) {
  console.log('STARTING DOWNLOADING BUILD DEPENDENCIES');
  console.log('buildDependencies:', buildDependencies);

  if (buildDependencies) {
    const ret = buildDependencies.map((dependency) => {
      const repoDir = getRepoDir(repoName);
      const buildDir = dependency.buildDir ?? repoDir;
      executeCliCommand({
        command: 'curl',
        args: [dependency.url, '-o', `${buildDir}/${dependency.filename}`],
      });
      return `curl ${dependency.url} -o ${buildDir}/${dependency.filename}`;
    });
    return ret;
  } else {
    return [];
  }
}

export async function prepareBuildAndGetDependencies(
  repoName: string,
  projectName: string,
  baseUrl: string,
  buildDependencies
) {
  // before we get build dependencies, we need to clone the repo
  await cloneRepo(repoName);

  const repoDir = getRepoDir(repoName);

  downloadBuildDependencies(buildDependencies, repoName);

  // doing these in parallel
  const commandPromises = [
    getCommitHash(repoDir),
    getCommitBranch(repoDir),
    getPatchId(repoDir),
    existsAsync(path.join(process.cwd(), 'config/redirects')),
    createEnvProdFile(repoDir, projectName, baseUrl),
  ];

  try {
    const dependencies = await Promise.all(commandPromises);

    return {
      commitHash: dependencies[0] as string,
      commitBranch: dependencies[1] as string,
      patchId: dependencies[2] as string | undefined,
      hasRedirects: dependencies[3] as boolean,
      bundlePath: `${repoDir}/bundle.zip`,
      repoDir,
    };
  } catch (error) {
    console.error('ERROR! Could not get build dependencies');
    throw error;
  }
}
