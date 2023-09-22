import fs from 'fs';
import path from 'path';
import { executeCliCommand, readFileAndExec } from './helpers';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

async function getPatchId(repoDir: string): Promise<string> {
  const filePath = path.join(repoDir, 'myPatch.patch');

  const { stdout: gitPatchId } = await readFileAndExec('git', filePath, ['patch-id']);

  return gitPatchId;
}

export async function nextGenParse(repoName: string): Promise<void> {
  const repoDir = path.join(__dirname, `repos/${repoName}`);

  const commandArgs = ['build', repoDir, '--output', `${repoDir}/bundle.zip`, RSTSPEC_FLAG];

  const hasPatch = !(await existsAsync(path.join(repoDir, 'myPatch.patch')));

  if (hasPatch) {
    const patchId = await getPatchId(repoDir);

    commandArgs.push('--patch');
    commandArgs.push(patchId);
  }

  await executeCliCommand('snooty', commandArgs);
}
