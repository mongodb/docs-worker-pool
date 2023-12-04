import os from 'os';
import * as c from 'config';
import { MongoClient } from 'mongodb';
import { getOctokitClient } from '../../../../clients/githubClient';
import { executeCliCommand } from '../../helpers';
import { getArgs } from './utils/get-args';
import { getWorkerEnv } from './utils/get-env-vars';
import { createLocalJob } from './utils/create-job';
import { DocsetsRepository } from '../../../../repositories/docsetsRepository';
import { ConsoleLogger } from '../../../../services/logger';

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
  const args = ['run', '-p', '9229:9229', '--rm', '-v', `${os.homedir()}/.aws:/home/docsworker-xlarge/.aws`];

  for (const envName in env) {
    args.push('-e');
    args.push(`${envName}=${env[envName]}`);
  }

  args.push('autobuilder/local:latest');
  return executeCliCommand({
    command: 'docker',
    args,
  });
}

async function main() {
  const { repoName, repoOwner, branchName } = getArgs();

  const env = await getWorkerEnv('stg');
  const octokitClient = getOctokitClient(env.GITHUB_BOT_PASSWORD);

  const commitPromise = octokitClient.request('GET /repos/{owner}/{repo}/commits/{ref}', {
    owner: repoOwner,
    repo: repoName,
    ref: branchName,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const buildPromise = buildDockerImage(env.NPM_BASE_64_AUTH);
  const dbClient = new MongoClient(env.MONGO_ATLAS_URL);

  console.log('Building docker container....');
  const [commit, connectedDbClient, buildResult] = await Promise.all([commitPromise, dbClient.connect(), buildPromise]);
  console.log(buildResult.errorText);
  console.log(buildResult.outputText);
  console.log('build complete');
  const db = connectedDbClient.db(env.DB_NAME);
  const collection = db.collection(env.JOB_QUEUE_COL_NAME);

  console.log('BRANCH NAME?!?!? ', branchName);

  const consoleLogger = new ConsoleLogger();

  const docsetsRepository = new DocsetsRepository(db, c, consoleLogger);
  const project = (await docsetsRepository.getProjectByRepoName(repoName)) as string;

  const job = createLocalJob({ commit: commit.data, branchName, repoName, repoOwner, project });

  console.log('insert job into queue collection');
  const { insertedId: jobId } = await collection.insertOne(job);

  console.log('starting container');
  const { outputText, errorText } = await runDockerContainer({ ...env, jobId: jobId.toString() });

  console.log('OUTPUT TEXT', outputText);
  console.log('ERROR TEXT', errorText);
}

main();
