import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { executeCliCommand } from './helpers';

async function getPatchId(): Promise<string | undefined> {
  if (!fs.existsSync(path.join(__dirname, 'myPatch.patch'))) return;

  const gitPatchId = await executeCliCommand('git', ['patch-id']);
}

export async function nextGenParse() {
  getPatchId();
}
