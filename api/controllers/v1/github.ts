import c from 'config';
import crypto, { Utf8AsciiLatin1Encoding } from 'crypto';
import mongodb from 'mongodb';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';

// This function will validate your payload from GitHub
// See docs at https://developer.github.com/webhooks/securing/#validating-payloads-from-github
function signRequestBody(key: string, body: string) {
  const enc = 'utf-8' as Utf8AsciiLatin1Encoding;
  return `sha1=${crypto.createHmac('sha1', key).update(body, enc).digest('hex')}`;
}

function prepGithubPushPayload(githubEvent: any): any {
  return {
    title: githubEvent.repository.full_name,
    user: githubEvent.pusher.name,
    email: githubEvent.pusher.email,
    status: 'inQueue',
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    payload: {
      jobType: 'githubPush',
      source: 'github',
      action: 'push',
      repoName: githubEvent.repository.name,
      branchName: githubEvent.ref.split('/')[2],
      isFork: githubEvent.repository.fork,
      private: githubEvent.repository.private,
      isXlarge: true,
      repoOwner: githubEvent.repository.owner.login,
      url: githubEvent.repository.clone_url,
      newHead: githubEvent.after,
    },
    logs: [],
  };
}

export const TriggerBuild = async (event: any = {}): Promise<any> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const sig = event.headers['X-Hub-Signature'];
  if (sig !== signRequestBody(c.get<string>('githubSecret'), event.body)) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }
  const body = JSON.parse(event.body);
  const job = prepGithubPushPayload(body);
  try {
    await jobRepository.insertJob(job);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err,
    };
  }
  return {
    statusCode: 202,
    headers: { 'Content-Type': 'text/plain' },
    body: 'Job Queued',
  };
};
