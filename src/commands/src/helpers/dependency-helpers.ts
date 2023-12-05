import path from 'path';
import fs from 'fs';
import { executeCliCommand, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);

async function cloneRepo(repoOwner: string, repoName: string) {
  const botName = process.env.GITHUB_BOT_USERNAME;
  const botPassword = process.env.GITHUB_BOT_PASSWORD;
  await executeCliCommand({
    command: 'git',
    args: ['clone', `https://${botName}:${botPassword}@github.com/${repoOwner}/${repoName}`],
    options: { cwd: `${process.cwd()}/repos` },
  });
}

async function pullRepo(
  repoDirName: string,
  branchName: string,
  newHead: string | null | undefined = null,
  logger: (msg: string) => void
) {
  const pullRepoCommands = [`git checkout ${branchName}`, ' && ', `git pull origin ${branchName}`];
  if (newHead) {
    pullRepoCommands.push(' && ', `git checkout ${newHead} .`);
  }

  await executeCliCommand({
    command: 'git',
    args: pullRepoCommands,
    options: { cwd: `${process.cwd()}/repos/${repoDirName}` },
    logger,
  });
}

async function createEnvProdFile(
  repoDir: string,
  projectName: string,
  baseUrl: string,
  logger: (message: string) => void,
  prefix = ''
) {
  const prodFileName = `${process.cwd()}/snooty/.env.production`;
  const prodDirName = repoDir;
  // const prodSnootyFileName = `${prodDirName}snooty/.env.production`;

  logger(`PRODFILENAME ${prodFileName}`);
  logger(`PRODDIRNAME: ${prodDirName}`);

  try {
    await writeFileAsync(
      prodFileName,
      `GATSBY_SITE=${projectName}
      GATSBY_MANIFEST_PATH=${prodDirName}/bundle.zip
      GATSBY_PARSER_USER=${process.env.USER}
      GATSBY_BASE_URL=${baseUrl}
      GATSBY_MARIAN_URL=${process.env.GATSBY_MARIAN_URL}
      PATH_PREFIX=${prefix}`,
      'utf8'
    );
  } catch (e) {
    console.error(`ERROR! Could not write to .env.production`);
    logger(`ERROR! Could not write to .env.production: ${e}`);
    throw e;
  }
}

export async function prepareBuildAndGetDependencies(
  repoOwner: string,
  repoName: string,
  projectName: string,
  baseUrl: string,
  branchName: string,
  preppedLogger: (message: string) => void,
  newHead?: string | null,
  directory?: string
) {
  // before we get build dependencies, we need to clone the repo
  // await cloneRepo(repoOwner, repoName);
  preppedLogger(`in Prepared build and get deps!!`);
  // await pullRepo(repoName, branchName, newHead, preppedLogger);

  const repoDir = getRepoDir(repoName, directory);
  // const repoDir = `repos/${repoName}`;

  // doing these in parallel
  const commandPromises = [
    getCommitHash(repoDir, preppedLogger),
    getCommitBranch(repoDir, preppedLogger),
    getPatchId(repoDir, preppedLogger),
    existsAsync(path.join(process.cwd(), 'config/redirects')),
    createEnvProdFile(repoDir, projectName, baseUrl, preppedLogger),
  ];

  try {
    const dependencies = await Promise.all(commandPromises);
    preppedLogger('dependencies ' + dependencies);

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
    preppedLogger(`error, could not get build deps: ${error}`);
    throw error;
  }
}
