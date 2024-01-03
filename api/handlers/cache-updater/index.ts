import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';

import { executeCliCommand } from '../../../src/commands/src/helpers';

const readdirAsync = promisify(fs.readdir);

interface TestEvent {
  repoOwner: string;
  repoName: string;
}

async function cloneDocsRepo(repoName: string, repoOwner: string) {
  try {
    const cloneResults = await executeCliCommand({
      command: 'git',
      args: ['clone', `https://github.com/${repoOwner}/${repoName}`, `/tmp/${repoName}`],
    });

    console.log('clone: ', cloneResults);
  } catch (e) {
    console.error('ERROR WHEN CLONING!!', e);
    return;
  }
}

async function createSnootyCache(repoName: string) {
  try {
    const results = await executeCliCommand({
      command: 'snooty',
      args: ['create-cache', `/tmp/${repoName}`, '--no-caching'],
    });

    console.log('results', results);
  } catch (e) {
    console.error('got error', e);
    throw e;
  }
}

async function uploadCacheToS3(repoName: string, repoOwner: string) {
  const BUCKET_NAME = 'snooty-parse-cache';
  const client = new S3Client({ region: 'us-east-2' });

  const cacheFileName = (await readdirAsync(os.tmpdir())).find((fileName) => fileName.startsWith('.snooty'));

  if (!cacheFileName) {
    throw new Error(`ERROR! Cache file not found for ${repoOwner}/${repoName}`);
  }
  const cacheFileStream = fs.createReadStream(`${os.tmpdir}/${cacheFileName}`);

  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: BUCKET_NAME,
        Key: cacheFileName,
        Body: cacheFileStream,
      },
    });

    upload.on('httpUploadProgress', (progress) => {
      console.log(progress);
    });

    await upload.done();
  } catch (e) {
    console.error('ERROR! Upload failed', e);
  } finally {
    cacheFileStream.close();
  }
}

export async function handler({ repoName, repoOwner }: TestEvent): Promise<unknown> {
  await cloneDocsRepo(repoName, repoOwner);

  await createSnootyCache(repoName);

  await uploadCacheToS3(repoName, repoOwner);

  return null;
}
