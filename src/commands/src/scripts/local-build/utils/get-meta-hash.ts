import path from 'path';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';

async function getFileHash(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');

    const filePath = path.join(process.cwd(), file);
    const stream = createReadStream(filePath);
    stream.setEncoding('hex');

    stream.pipe(hash);

    stream.on('end', () => {
      hash.end();
      const hashBuffer: Buffer | undefined = hash.read();

      if (hashBuffer) {
        resolve(hashBuffer.toString('hex'));
        return;
      }

      reject(new Error('Could not create hash'));
    });
  });
}

const visited = new Set<string>();

export async function getMetaHash(directory: string) {
  getFileHash('test');
}
