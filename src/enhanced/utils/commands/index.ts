import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';

function getPatchId(): string | undefined {
  if (!fs.existsSync(path.join(__dirname, 'myPatch.patch'))) return;
}

export function nextGenParse() {
  getPatchId();
}
