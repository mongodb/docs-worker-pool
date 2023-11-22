import mongodb from 'mongodb';

import { getOctokitClient } from '../../../../clients/githubClient';
import { CliCommandResponse, executeCliCommand } from '../../helpers';
import { getArgs } from './utils/get-args';
import { getWorkerEnv } from './utils/get-env-vars';

const buildDockerImage = async (npmAuth: string) =>
  executeCliCommand({
    command: 'docker',
    args: [
      'buildx',
      'build',
      '--file',
      'Dockerfile.local',
      '.',
      '--build-arg',
      `NPM_BASE_64_AUTH=${npmAuth}`,
      '--build-arg',
      'NPM_EMAIL=docs-platform',
      '-t',
      'autobuilder/local:latest',
    ],
  });

async function runDockerContainer(env: Record<string, string>) {
  const args = ['run', '-p', '9229:9229', '--rm', '-v', '~/.aws:/home/docsworker/.aws'];

  for (const envName in env) {
    args.push('-e');
    args.push(`${envName}="${env[envName]}"`);
  }

  args.push('autobuilder/local:latest');
  return executeCliCommand({
    command: 'docker',
    args,
  });
}

async function main() {
  const env = await getWorkerEnv('stg');

  const npmAuth = env.NPM_BASE_64_AUTH;
  const octokitClient = getOctokitClient();

  const { repoName, repoOwner, branchName } = getArgs();

  const commitPromise = octokitClient.request('GET /repos/{owner}/{repo}/commits/{ref}', {
    owner: repoOwner,
    repo: repoName,
    ref: branchName,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const buildPromise = buildDockerImage(npmAuth);

  const DB_URL = 'TODO: Construct this from parameter store values';
  const DB_NAME = 'pool_test';
  const QUEUE_COLLECTION_NAME = 'queue';

  const dbClient = new mongodb.MongoClient(DB_URL);

  const promises: [typeof commitPromise, Promise<mongodb.MongoClient>, Promise<CliCommandResponse>] = [
    commitPromise,
    dbClient.connect(),
    buildPromise,
  ];

  const [commit, connectedDbClient] = await Promise.all(promises);

  const db = connectedDbClient.db(DB_NAME);

  const collection = db.collection(QUEUE_COLLECTION_NAME);

  // TODO: Make commit.data into job shape
  const job = commit.data;
  const { insertedId: jobId } = await collection.insertOne(job);

  await runDockerContainer({ ...env, JOB_ID: jobId.toString() });
}

main();
