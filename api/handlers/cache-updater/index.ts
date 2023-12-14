import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { executeCliCommand } from '../../../src/commands/src/helpers';

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

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
  }
}

async function uploadCacheToS3(fileName: string, content: Buffer) {
  const BUCKET_NAME = 'snooty-parse-cache';
  const client = new S3Client({ region: 'us-east-2' });

  const uploadCommand = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: content,
  });

  const response = await client.send(uploadCommand);
}

async function getCachedFiles(repoName: string) {
  const cacheFile = (await readdirAsync(os.tmpdir())).find((fileName) => fileName.startsWith('.snooty'));

  if (!cacheFile) {
    throw new Error(`ERROR! Cache file not found for ${repoName}`);
  }
}

export async function handler({ repoName, repoOwner }: TestEvent): Promise<unknown> {
  await cloneDocsRepo(repoName, repoOwner);

  await createSnootyCache(repoName);

  return null;
}
