import path from 'path';
import fs from 'fs';
import { checkIfPatched, getCommitBranch, getCommitHash, getPatchId, getRepoDir } from '.';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);

async function createEnvProdFile(repoDir: string, projectName: string, baseUrl: string, prefix = '') {
  const prodFileName = `${process.cwd()}/snooty/.env.production`;

  try {
    await writeFileAsync(
      prodFileName,
      `GATSBY_BASE_URL=docs.mongodb.com
      GATSBY_SITE=${projectName}
      GATSBY_MANIFEST_PATH=${repoDir}/bundle.zip
      GATSBY_PARSER_USER=${process.env.USER}
      GATSBY_BASE_URL=${baseUrl}
      GATSBY_PATH_PREFIX=${prefix}`,
      'utf8'
    );
  } catch (e) {
    console.error(`ERROR! Could not write to .env.production`);
    throw e;
  }
}

export async function getCliBuildDependencies(repoDir: string, projectName: string, baseUrl: string) {
  const commandPromises = [
    checkIfPatched(repoDir),
    getCommitHash(repoDir),
    getCommitBranch(repoDir),
    getPatchId(repoDir),
    existsAsync(path.join(process.cwd(), 'config/redirects')),
    createEnvProdFile(repoDir, projectName, baseUrl),
  ];

  const deps = await Promise.all(commandPromises);
  return {
    hasPatch: deps[0] as string,
    commitHash: deps[1] as string,
    commitBranch: deps[2] as string,
    patchId: deps[3] as string | undefined,
    hasRedirects: deps[4] as boolean,
    bundlePath: `${repoDir}/bundle.zip`,
  };
}
