import * as c from 'config';
import crypto from 'crypto';
import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ConsoleLogger } from '../../src/services/logger';
import { MongoClient } from 'mongodb';
import { JobRepository } from '../../src/repositories/jobRepository';
import { GithubCommenter } from '../../src/services/github';
import { SlackConnector } from '../../src/services/slack';
import { RepoEntitlementsRepository } from '../../src/repositories/repoEntitlementsRepository';
import { EnhancedJob, Job, JobStatus, Payload } from '../../src/entities/job';

// Although data in payload should always be present, it's not guaranteed from
// external callers
interface SnootyPayload {
  jobId?: string;
  status?: JobStatus;
}

// These options should only be defined if the build summary is being called after
// a Gatsby Cloud job
interface BuildSummaryOptions {
  mongoClient?: MongoClient;
  previewUrl?: string;
}

export const extractUrlFromMessage = (fullDocument): string[] => {
  const { logs } = fullDocument;
  const urls = logs?.length > 0 ? logs.flatMap((log) => log.match(/\bhttps?:\/\/\S+/gi) || []) : [];
  return urls.map((url) => url.replace(/([^:]\/)\/+/g, '$1'));
};

function prepGithubComment(
  fullDocument: Job | EnhancedJob,
  jobUrl: string,
  isUpdate = false,
  previewUrl?: string
): string {
  if (isUpdate) {
    return `\n* job log: [${fullDocument.payload.newHead}](${jobUrl})`;
  }
  let stagingUrl = '';
  if (previewUrl) stagingUrl = previewUrl;
  else {
    const urls = extractUrlFromMessage(fullDocument);
    if (urls.length > 0) {
      stagingUrl = urls[urls.length - 1];
    }
  }
  return `✨ Staging URL: [${stagingUrl}](${stagingUrl})\n\n#### 🪵 Logs\n\n* job log: [${fullDocument.payload.newHead}](${jobUrl})`;
}

async function prepSummaryMessage(
  env: string,
  fullDocument: Job,
  repoName: string,
  jobUrl: string,
  jobId: string,
  failed = false,
  previewUrl?: string
): Promise<string> {
  const urls = extractUrlFromMessage(fullDocument);
  let mms_urls: Array<string | null> = [null, null];
  // mms-docs needs special handling as it builds two sites (cloudmanager & ops manager)
  // so we need to extract both URLs
  if (repoName === 'mms-docs') {
    if (urls.length >= 2) {
      mms_urls = urls.slice(-2);
    }
  }

  let url = '';
  if (previewUrl) {
    url = previewUrl;
  } else if (urls.length > 0) {
    url = urls[urls.length - 1];
  }

  let msg = '';
  if (failed) {
    msg = `Your Job <${jobUrl}${jobId}|Failed>! Please check the build log for any errors.\n- Repo: *${repoName}*\n- Branch: *${fullDocument.payload.branchName}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env: *${env}*\n Check logs for more errors!!\nSorry  :disappointed:! `;
  } else {
    if (repoName == 'mms-docs') {
      msg = `Your Job <${jobUrl}${jobId}|Completed>! \n- Repo: *${repoName}*\n- Branch: *${fullDocument.payload.branchName}*\n- Commit: *${fullDocument.payload.newHead}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env: *${env}*\n*Urls*\n   *CM*: <${mms_urls[0]}|Cloud Manager> \n   *OPM*: <${mms_urls[1]}|OPS Manager>\n- InvalidationStatus: <${fullDocument.invalidationStatusURL}|Status> \nEnjoy  :smile:!`;
    } else {
      msg = `Your Job <${jobUrl}${jobId}|Completed>! \n- Repo: *${repoName}*\n- Branch: *${fullDocument.payload.branchName}*\n- Commit: *${fullDocument.payload.newHead}*\n- urlSlug: *${fullDocument.payload.urlSlug}*\n- Env: *${env}*\n- Url: <${url}|${repoName}>\n- InvalidationStatus: <${fullDocument.invalidationStatusURL}|Status> \nEnjoy  :smile:!`;
    }
  }
  // Remove instances of two or more periods
  return msg.replace(/\.{2,}/g, '');
}

export async function notifyBuildSummary(jobId: string, options: BuildSummaryOptions = {}): Promise<any> {
  const { mongoClient, previewUrl } = options;
  const consoleLogger = new ConsoleLogger();
  const client: MongoClient = mongoClient ?? new MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  const env = c.get<string>('env');
  const githubToken = c.get<string>('githubBotPW');

  const jobRepository = new JobRepository(db, c, consoleLogger);
  // TODO: Make fullDocument be of type Job, validate existence
  const fullDocument = await jobRepository.getJobById(jobId);
  if (!fullDocument) {
    consoleLogger.error(jobId, 'Cannot find job entry in db');
    return;
  }
  const repoName = fullDocument.payload.repoName;
  const username = fullDocument.user;
  const githubCommenter = new GithubCommenter(consoleLogger, githubToken);
  const slackConnector = new SlackConnector(consoleLogger, c);

  // Create/Update Github comment
  try {
    const parentPRs = await githubCommenter.getParentPRs(fullDocument.payload);
    for (const pr of parentPRs) {
      const prCommentId = await githubCommenter.getPullRequestCommentId(fullDocument.payload, pr);
      const fullJobDashboardUrl = c.get<string>('dashboardUrl') + jobId;

      if (prCommentId !== undefined) {
        const ghMessage = prepGithubComment(fullDocument, fullJobDashboardUrl, true, previewUrl);
        await githubCommenter.updateComment(fullDocument.payload, prCommentId, ghMessage);
      } else {
        const ghMessage = prepGithubComment(fullDocument, fullJobDashboardUrl, false, previewUrl);
        await githubCommenter.postComment(fullDocument.payload, pr, ghMessage);
      }
    }
  } catch (err) {
    consoleLogger.error(jobId, `Failed to comment on GitHub: ${err}`);
  }

  // Slack notification
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getSlackUserIdByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement failed');
    return;
  }
  await slackConnector.sendMessage(
    await prepSummaryMessage(
      env,
      fullDocument,
      repoName,
      c.get<string>('dashboardUrl'),
      jobId,
      fullDocument.status == 'failed',
      previewUrl
    ),
    entitlement['slack_user_id']
  );
  await client.close();
  return {
    statusCode: 200,
  };
}

/**
 * Checks the signature payload as a rough validation that the request was made by
 * the Snooty frontend.
 * @param payload - stringified JSON payload
 * @param signature - the Snooty signature included in the header
 */
function validateSnootyPayload(payload: string, signature: string) {
  const secret = c.get<string>('snootySecret');
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return signature === expectedSignature;
}

/**
 * Performs post-build operations such as notifications and db updates for job ID
 * provided in its payload. This is typically expected to only be called by
 * Snooty's Gatsby Cloud source plugin.
 * @param event
 * @returns
 */
export async function snootyBuildComplete(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const consoleLogger = new ConsoleLogger();
  const defaultHeaders = { 'Content-Type': 'text/plain' };

  if (!event.body) {
    const err = 'SnootyBuildComplete does not have a body in event payload';
    consoleLogger.error('SnootyBuildCompleteError', err);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: err,
    };
  }

  // Keep lowercase in case header is automatically converted to lowercase
  // The Snooty frontend should be mindful of using a lowercase header
  const snootySignature = event.headers['x-snooty-signature'];
  if (!snootySignature) {
    const err = 'SnootyBuildComplete does not have a signature in event payload';
    consoleLogger.error('SnootyBuildCompleteError', err);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: err,
    };
  }

  if (!validateSnootyPayload(event.body, snootySignature)) {
    const errMsg = 'Payload signature is incorrect';
    consoleLogger.error('SnootyBuildCompleteError', errMsg);
    return {
      statusCode: 401,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  let payload: SnootyPayload | undefined;
  try {
    payload = JSON.parse(event.body) as SnootyPayload;
  } catch (e) {
    const errMsg = 'Payload is not valid JSON';
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  const { jobId } = payload;
  if (!jobId) {
    const errMsg = 'Payload missing job ID';
    consoleLogger.error('SnootyBuildCompleteError', errMsg);
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: errMsg,
    };
  }

  const client = new MongoClient(c.get('dbUrl'));

  try {
    await client.connect();
    const db = client.db(c.get<string>('dbName'));
    const jobRepository = new JobRepository(db, c, consoleLogger);
    const updateResponse = await jobRepository.updateWithStatus(jobId, null, payload.status || JobStatus.failed, false);
    const previewUrl = getPreviewUrl(updateResponse.payload, c.get<string>('env'));
    await notifyBuildSummary(jobId, { mongoClient: client, previewUrl });
  } catch (e) {
    consoleLogger.error('SnootyBuildCompleteError', e);
    return {
      statusCode: 500,
      headers: defaultHeaders,
      body: e,
    };
  } finally {
    await client.close();
  }

  return {
    statusCode: 200,
    headers: defaultHeaders,
    body: `Snooty build ${jobId} completed`,
  };
}

/**
 * Assembles Gatsby Preview URL address for Job post-build
 * @param payload
 * @returns string|undefined
 */
function getPreviewUrl(payload: Payload | undefined, env: string): string | undefined {
  if (!payload) return;
  const { repoOwner, branchName, project } = payload;
  const githubUsernameNoHyphens = repoOwner.split('-').join('').toLowerCase();
  const possibleStagingSuffix = env === 'stg' ? 'stg' : '';
  return `https://preview-mongodb${githubUsernameNoHyphens}${possibleStagingSuffix}.gatsbyjs.io/${project}/${branchName}/index`;
}
