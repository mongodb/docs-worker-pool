import { FastlyConnector } from '../../../src/services/cdn';
import { ConsoleLogger } from '../../../src/services/logger';
import { CDNCreds } from '../../../src/entities/creds';
import * as c from 'config';
import * as crypto from 'crypto';
import * as mongodb from 'mongodb';
import { JobRepository } from '../../../src/repositories/jobRepository';
import { BranchRepository } from '../../../src/repositories/branchRepository';
import { JobType } from '../../../src/entities/job';

export const UpsertEdgeDictionaryItem = async (event: any = {}): Promise<any> => {
  const body = JSON.parse(event.body);
  const pair = {
    key: body.source,
    value: body.target,
  };
  const creds = new CDNCreds(process.env.FASTLY_DOCHUB_SERVICE_ID, process.env.FASTLY_DOCHUB_TOKEN);
  await new FastlyConnector(new ConsoleLogger()).upsertEdgeDictionaryItem(pair, process.env.FASTLY_DOCHUB_MAP, creds);
  return {
    statusCode: 202,
    headers: { 'Content-Type': 'text/plain' },
    body: 'success',
  };
};

async function prepDochubPushPayload() {
  return {
    title: 'DevHub CMS Prod Build',
    user: 'jestapinski',
    email: 'split@nothing.com',
    status: 'inQueue',
    createdTime: new Date(),
    startTime: null,
    endTime: null,
    priority: 1,
    error: {},
    result: null,
    payload: {
      jobType: JobType.githubPush,
      source: 'strapi',
      action: 'push',
      repoName: 'devhub-content',
      branchName: 'master',
      isFork: true,
      private: true,
      isXlarge: true,
      repoOwner: '10gen',
      url: 'https://github.com/10gen/devhub-content',
      newHead: null,
      urlSlug: null,
      prefix: '',
      project: 'devhub-content',
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
  const env = c.get<string>('env');
  const job = await prepDochubPushPayload();

  try {
    consoleLogger.info(job.title, 'Creating Job');
    const jobId = await jobRepository.insertJob(job, c.get('jobsQueueUrl'));
    consoleLogger.info(job.title, `Created Job ${jobId}`);
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'text/plain' },
      body: jobId,
    };
  } catch (err) {
    consoleLogger.error('TriggerBuild', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: err.message,
    };
  }
};
