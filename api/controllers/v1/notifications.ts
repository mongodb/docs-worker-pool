import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';

export const NotifyBuildSummary = async (event: any = {}): Promise<any> => {
  console.log('NotifyBuildSummary', event);
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  if (!JSON.stringify(event?.detail?.updateDescription?.updatedFields).includes('comMessage')) {
    return;
  }
  const jobId = event.detail.documentKey._id;

  const jobRepository = new JobRepository(db, c, consoleLogger);
  event.detail.fullDocument = await jobRepository.getJobById(jobId);

  const slackMsgs = event.detail.fullDocument.comMessage;
  // check if summary exists to send to slack
  if (!slackMsgs) {
    consoleLogger.error(event.fullDocument._id, 'ERROR: Empty slack message array.');
    return;
  }

  const jobTitle = event.detail.fullDocument.title;
  const repoName = event.detail.fullDocument.payload.repoName;
  const username = event.detail.fullDocument.user;
  const slackConnector = new SlackConnector(consoleLogger, c);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepSummaryMessage(
      repoName,
      limit_message_size(slackMsgs[slackMsgs.length - 1]),
      c.get<string>('dashboardUrl'),
      jobId,
      jobTitle
    ),
    entitlement['slack_user_id']
  );

  console.log(resp);
  return {
    statusCode: 200,
  };
};

function limit_message_size(message) {
  while (message.length >= 256) {
    let end = 255;
    while (message[end] != ' ') {
      end -= 1;
    }
    message = message.substring(0, end + 1);
  }
  return message;
}

function prepSummaryMessage(
  repoName: string,
  lastMessage: string,
  jobUrl: string,
  jobId: string,
  jobTitle: string
): string {
  // TODO: Determine why mms-docs has a special lastMessage slicing
  if (repoName === 'mms-docs') {
    lastMessage = `${lastMessage.slice(lastMessage.indexOf('mut-publish'))}\n\n${lastMessage.slice(
      lastMessage.lastIndexOf('Summary')
    )}`;
  }
  const msg = `Your Job (<${jobUrl}${jobId}|${jobTitle}>) finished! Please check the build log for any errors.\n${lastMessage}\nEnjoy!`;
  // Removes instances of two or more periods
  return msg.replace(/\.{2,}/g, '');
}

function prepProgressMessage(
  operationType: string,
  jobUrl: string,
  jobId: string,
  jobTitle: string,
  status: string
): string {
  const msg = `Your Job (<${jobUrl}${jobId}|${jobTitle}>) `;
  if (operationType === 'insert') {
    return msg + 'has successfully been added to the queue.';
  }
  switch (status) {
    case 'inProgress':
      return msg + 'is now being processed.';
    case 'completed':
      return msg + 'has successfully completed.';
    case 'failed':
      return msg + 'has failed and will not be placed back in the queue.';
    default:
      return msg + 'has been updated to an unsupported status.';
  }
}

export const NotifyBuildProgress = async (event: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));

  const slackConnector = new SlackConnector(consoleLogger, c);
  const jobRepository = new JobRepository(db, c, consoleLogger);
  const jobId = event.detail.documentKey._id;
  event.detail.fullDocument = await jobRepository.getJobById(jobId);
  const jobTitle = event.detail.fullDocument.title;
  const username = event.detail.fullDocument.user;
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement?.['slack_user_id']) {
    consoleLogger.error(username, 'Entitlement Failed');
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepProgressMessage(
      event.detail.operationType,
      c.get('dashboardUrl'),
      jobId,
      jobTitle,
      event.detail.fullDocument.status
    ),
    entitlement['slack_user_id']
  );
  console.log(resp);
  return {
    statusCode: 200,
  };
};
