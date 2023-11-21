import path from 'path';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

async function getFileHash(file: string) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path.join(process.cwd(), file));
  });
}

const visited = new Set<string>();

export async function getMetaHash(directory: string) {
  getFileHash('test');
}
