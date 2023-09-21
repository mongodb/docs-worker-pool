import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { executeCliCommand } from './helpers';

const RSTSPEC_FLAG = '--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml';

async function getPatchId(): Promise<string> {
  const gitPatchId = await executeCliCommand<string>('git', ['patch-id']);

  return gitPatchId;
}
async function getPatchClause() {
  throw new Error('not implemented');
}
export async function nextGenParse(): Promise<void> {
  const defaultParseArgs = [];
  const isPatch = !fs.existsSync(path.join(__dirname, 'myPatch.patch'));
  const commandArgs = isPatch ? [...defaultParseArgs, '--commit'] : defaultParseArgs;
  if (!fs.existsSync(path.join(__dirname, 'myPatch.patch'))) {
    await getPatchId();
  }
}
