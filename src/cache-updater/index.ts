import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Upload } from '@aws-sdk/lib-storage';
import { S3Client } from '@aws-sdk/client-s3';

import { executeCliCommand } from '../commands/src/helpers';

const readdirAsync = promisify(fs.readdir);
const { SNOOTY_CACHE_BUCKET_NAME, GITHUB_BOT_USERNAME, GITHUB_BOT_PASSWORD } = process.env;

if (!SNOOTY_CACHE_BUCKET_NAME) throw new Error('ERROR! SNOOTY_CACHE_BUCKET_NAME is not defined');

async function cloneDocsRepo(repoName: string, repoOwner: string) {
  if (!GITHUB_BOT_USERNAME) {
    const errorMessage = `ERROR! GITHUB_BOT_USERNAME is not set. ${repoOwner}/${repoName} will not have their cache updated`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!GITHUB_BOT_PASSWORD) {
    const errorMessage = `ERROR! GITHUB_BOT_PASSWORD is not set. ${repoOwner}/${repoName} will not have their cache updated`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  try {
    const cloneResults = await executeCliCommand({
      command: 'git',
      args: ['clone', `https://${GITHUB_BOT_USERNAME}:${GITHUB_BOT_PASSWORD}@github.com/${repoOwner}/${repoName}`],
    });

    console.log('clone: ', cloneResults);
  } catch (e) {
    console.error('ERROR WHEN CLONING!!', e);
    throw e;
  }
}

async function createSnootyCache(repoName: string) {
  try {
    const results = await executeCliCommand({
      command: 'snooty',
      args: ['create-cache', repoName, '--no-caching'],
    });

    console.log('results', results);
  } catch (e) {
    console.error('got error', e);
    throw e;
  }
}

async function uploadCacheToS3(repoName: string, repoOwner: string) {
  const client = new S3Client({ region: 'us-east-2' });

  const repoPath = path.join(__dirname, repoName);
  const cacheFileName = (await readdirAsync(repoPath)).find((fileName) => fileName.startsWith('.snooty'));

  if (!cacheFileName) {
    throw new Error(`ERROR! Cache file not found for ${repoOwner}/${repoName}`);
  }

  const cacheFilePath = path.join(repoPath, cacheFileName);

  const cacheFileStream = fs.createReadStream(cacheFilePath);

  try {
    // this class conveniently handles multi-part uploads to S3.
    // Overwrites current cache file if identical one exists.
    const upload = new Upload({
      client,
      params: {
        Bucket: SNOOTY_CACHE_BUCKET_NAME,
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
    throw e;
  } finally {
    cacheFileStream.close();
  }
}

export interface RepoInfo {
  repoOwner: string;
  repoName: string;
}

/**
 * The handler function processes a request to rebuild a doc site's Snooty cache.
 * @param repoName - the name of the repository that we are creating a cache for.
 */
export async function handler({ repoName, repoOwner }: RepoInfo): Promise<void> {
  console.log(`-------- Cloning repository: ${repoOwner}/${repoName} ------------`);
  await cloneDocsRepo(repoName, repoOwner);
  console.log(`-------- Creating cache ------------`);
  await createSnootyCache(repoName);

  console.log(`-------- Uploading cache to S3 ------------`);

  await uploadCacheToS3(repoName, repoOwner);

  console.log('-------- Upload complete ------------');
}

function getRepos(): RepoInfo[] {
  const reposString = process.env.REPOS;

  if (!reposString) throw new Error('Error: REPOS is not defined');

  try {
    const repos = JSON.parse(reposString);
    return repos.filter(({ repoName, repoOwner }: RepoInfo) => {
      const isRepoInfo = typeof repoName === 'string' && typeof repoOwner === 'string';

      if (!isRepoInfo) {
        console.warn(`Invalid repo information for cache update job. 
        Values provided: repoName -> ${repoName} repoOwner -> ${repoOwner}`);
      }

      return isRepoInfo;
    });
  } catch (error) {
    console.error('Error when parsing the process.env.REPOS environment variable. Is it set?');
    throw error;
  }
}

async function main() {
  const repos = getRepos();

  await Promise.all(
    repos.map((repo) =>
      handler(repo).catch((error) => {
        console.error('An error occurred!', error);
      })
    )
  );

  process.exit(0);
}

main();
