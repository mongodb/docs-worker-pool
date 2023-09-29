import fs from 'fs';
import { promisify } from 'util';
import { executeCliCommand, getRepoDir } from '../helpers';

const writeFileAsync = promisify(fs.writeFile);

async function createEnvProdFile(repoDir: string, projectName: string) {
  try {
    await writeFileAsync(
      `${process.cwd()}/snooty/.env.production`,
      `GATSBY_BASE_URL=docs.mongodb.com
      GATSBY_SITE=${projectName}
      GATSBY_MANIFEST_PATH=${repoDir}/bundle.zip`,
      'utf8'
    );
  } catch (e) {
    console.error(`ERROR! Could not write to .env.production`);
    throw e;
  }
}
export async function nextGenHtml(repoName: string) {
  const repoDir = getRepoDir(repoName);

  // might move this since technically next-gen-html doesn't create the file
  await createEnvProdFile(repoDir, 'java');

  const result = await executeCliCommand({
    command: 'npm',
    args: ['run', 'build'],
    options: { cwd: `${process.cwd()}/snooty` },
  });

  return result;
}
