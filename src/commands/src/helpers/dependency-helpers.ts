import path from 'path';
import fs from 'fs';
import { executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);

async function cloneRepo(repoName: string) {
  const botName = process.env.GITHUB_BOT_USERNAME;
  const botPassword = process.env.GITHUB_BOT_PASSWORD;
  await executeCliCommand({
    command: 'git',
    args: ['clone', `https://${botName}:${botPassword}@github.com/10gen/${repoName}`],
    options: { cwd: `${process.cwd()}/repos` },
  });
}
async function createEnvProdFile(repoDir: string, projectName: string, baseUrl: string, prefix = '') {
  const prodFileName = `${process.cwd()}/snooty/.env.production`;
  const prodDirName = repoDir;
  // const prodSnootyFileName = `${prodDirName}snooty/.env.production`;

  try {
    await writeFileAsync(
      prodFileName,
      `GATSBY_SITE=${projectName}
      GATSBY_MANIFEST_PATH=${prodDirName}/bundle.zip
      GATSBY_PARSER_USER=${process.env.USER}
      GATSBY_BASE_URL=${baseUrl}
      PATH_PREFIX=${prefix}`,
      'utf8'
    );
  } catch (e) {
    console.error(`ERROR! Could not write to .env.production`);
    throw e;
  }
}

export async function prepareBuildAndGetDependencies(
  repoName: string,
  projectName: string,
  baseUrl: string,
  directory?: string
) {
  console.log('cwd: ', process.cwd());
  // before we get build dependencies, we need to clone the repo
  await cloneRepo(repoName);

  const repoDir = getRepoDir(repoName, directory);
  // const repoDir = `repos/${repoName}`;

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
    console.log('dependencies ', dependencies);

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