import fs from 'fs';
import { promisify } from 'util';
import { getRepoDir } from './helpers';

const writeFileAsync = promisify(fs.writeFile);

async function createEnvProdFile(repoDir: string) {
  await writeFileAsync(repoDir, '', 'utf8');
}
export async function nextGenHtml(repoName: string) {
  const repoDir = getRepoDir(repoName);
  await createEnvProdFile(repoName);
}
