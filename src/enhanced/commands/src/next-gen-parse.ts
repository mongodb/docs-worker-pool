import fs from 'fs';
import path from 'path';
import { executeCliCommand } from './helpers';
import { promisify } from 'util';

const openAsync = promisify(fs.open);
const existsAsync = promisify(fs.exists);
const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

async function getPatchId(): Promise<string> {
  const fileId = await openAsync(path.join(__dirname, 'myPatch.patch'), 'r');
  const { stdout: gitPatchId } = await executeCliCommand('git', ['patch-id'], {
    stdio: [fileId, process.stdout, process.stderr],
  });

  fs.close(fileId, (err) => {
    if (err) {
      console.error('error when closing myPatch.patch', err);
    }
  });

  return gitPatchId;
}
async function getPatchClause() {
  throw new Error('not implemented');
}

async function snootyBuild() {
  throw new Error('not implemented');
}

export async function nextGenParse(repoName: string): Promise<void> {
  const repoDir = path.join(__dirname, `repos/${repoName}`);
  const defaultParseArgs = [];
  const isPatch = !(await existsAsync(path.join(repoDir, 'myPatch.patch')));

  const commandArgs = isPatch ? [...defaultParseArgs, '--commit'] : defaultParseArgs;
}
