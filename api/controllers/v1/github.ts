import * as c from 'config';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { BranchRepository } from '../../../src/repositories/branchRepository';

// This function will validate your payload from GitHub
// See docs at https://developer.github.com/webhooks/securing/#validating-payloads-from-github
function validateJsonWebhook(request: any, secret: string) {
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(request.body).digest('hex');
  const signature = request.headers['X-Hub-Signature-256'];
  if (signature !== expectedSignature) {
    return false;
  }
  return true;
}

async function prepGithubPushPayload(githubEvent: any, branchRepository: BranchRepository, prefix: string) {
  const branch_name = githubEvent.ref.split('/')[2];
  const branch_info = await branchRepository.getRepoBranchAliases(githubEvent.repository.name, branch_name);
  const urlSlug = branch_info.aliasObject?.urlSlug ?? branch_name;
  const repo_info = await branchRepository.getRepo(githubEvent.repository.name);
  const project = repo_info?.project ?? githubEvent.repository.name;

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
    buildDepsExeStartTime: 0,
    buildDepsExeEndTime: 0,
    parseExeStartTime: 0,
    parseExeEndTime: 0,
    htmlExeStartTime: 0,
    htmlExeEndTime: 0,
    oasPageBuildExeStartTime: 0,
    oasPageBuildExeEndTime: 0,
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
      urlSlug: urlSlug,
      prefix: prefix,
      project: project,
    },
    logs: [],
  };
}

export const TriggerBuild = async (event: any = {}, context: any = {}): Promise<any> => {
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const consoleLogger = new ConsoleLogger();
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const branchRepository = new BranchRepository(db, c, consoleLogger);
  const sig = event.headers['X-Hub-Signature-256'];
  if (!validateJsonWebhook(event, c.get<string>('githubSecret'))) {
    const errMsg = "X-Hub-Signature incorrect. Github webhook token doesn't match";
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: errMsg,
    };
  }
  const body = JSON.parse(event.body);

  if (body.deleted) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Job Ignored (Deletion)',
    };
  }

  const env = c.get<string>('env');
  const repoInfo = await branchRepository.getRepo(body.repository.name);
  const jobPrefix = repoInfo?.prefix ? repoInfo['prefix'][env] : '';
  // TODO: Make job be of type Job
  const job = await prepGithubPushPayload(body, branchRepository, jobPrefix);
  try {
    consoleLogger.info(job.title, 'Creating Job');
    const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
    consoleLogger.info(job.title, `Created Job ${jobId}`);
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
