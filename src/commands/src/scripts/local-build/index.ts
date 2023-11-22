import mongodb from 'mongodb';

import { getOctokitClient } from '../../../../clients/githubClient';
import { executeCliCommand } from '../../helpers';
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

  const buildPromise = buildDockerImage(env.NPM_BASE_64_AUTH);
  const dbClient = new mongodb.MongoClient(env.DB_URL);

  const [commit, connectedDbClient] = await Promise.all([commitPromise, dbClient.connect(), buildPromise]);

  const db = connectedDbClient.db(env.DB_NAME);
  const collection = db.collection(env.QUEUE_COLLECTION_NAME);

  // TODO: Make commit.data into job shape
  const job = commit.data;
  const { insertedId: jobId } = await collection.insertOne(job);

  await runDockerContainer({ ...env, jobId: jobId.toString() });
}

main();
