import fs from 'fs';
import { promisify } from 'util';
import { getRepoDir } from '../helpers/helpers';

const writeFileAsync = promisify(fs.writeFile);

async function createEnvProdFile(repoDir: string) {
  await writeFileAsync(repoDir, '', 'utf8');
}
export async function nextGenHtml(repoName: string) {
  const repoDir = getRepoDir(repoName);

  // might move this since technically next-gen-html doesn't create the file
  await createEnvProdFile(repoDir);
}
