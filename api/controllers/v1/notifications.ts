import * as c from 'config';
import * as mongodb from 'mongodb';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { SlackConnector } from '../../../src/services/slack';
import { JobRepository } from '../../../src/repositories/jobRepository';

export const NotifyBuildSummary = async (event: any = {}): Promise<any> => {
  console.log("NotifyBuildSummary",event);
  const consoleLogger = new ConsoleLogger();
  const client = new mongodb.MongoClient(c.get('dbUrl'));
  await client.connect();
  const db = client.db(c.get('dbName'));
  if (JSON.stringify(event.detail.updateDescription.updatedFields).indexOf('comMessage') === -1) {
    return;
  }
  const jobId = event.detail.documentKey._id;
  
  const jobRepository = new JobRepository(db, c, consoleLogger);
  event.detail.fullDocument = await jobRepository.getJobById(jobId);

  const slackMsgs = event.detail.fullDocument.comMessage;
  // check if summary exists to send to slack
  if (slackMsgs === undefined || slackMsgs.length === 0) {
    consoleLogger.error(event.fullDocument._id, 'ERROR: Empty slack message array.');
    return;
  }

  const jobTitle = event.detail.fullDocument.title;
  const repoName = event.detail.fullDocument.payload.repoName;
  const username = event.detail.fullDocument.user;
  const slackConnector = new SlackConnector(consoleLogger, c);
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement || !entitlement['slack_user_id']) {
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepSummaryMessage(repoName,limit_message_size(slackMsgs[slackMsgs.length - 1]), c.get<string>('dashboardUrl'), jobId, jobTitle),
    entitlement['slack_user_id']
  );

  console.log(resp)
  return {
    'statusCode': 200,
  }
};

function limit_message_size(message) {
  while (message.length >= 256) {
    let end = 255
    while (message[end]!= ' ') {
        end-=1
    }
    message = message.substring(0, end+1)
    }
    return message

}

function prepSummaryMessage(
  repoName: string,
  lastMessage: string,
  jobUrl: string,
  jobId: string,
  jobTitle: string
): string {
  if (repoName === 'mms-docs') {
    let modMmsOutput: string;
    modMmsOutput = lastMessage.substr(0, lastMessage.indexOf('mut-publish'));
    modMmsOutput = modMmsOutput + '\n\n';
    modMmsOutput = modMmsOutput + lastMessage.substr(lastMessage.lastIndexOf('Summary'));
    lastMessage = modMmsOutput;
  }
  let message = 'Your Job (<' + jobUrl + jobId + '|' + jobTitle + '>) ';
  message += 'finished! Please check the build log for any errors';
  // only get the summary portion of build output
  message += '\n' + lastMessage;
  message += '\n' + 'Enjoy!';
  message = message.replace(/\.{2,}/g, '');
  return message;
}

function prepProgressMessage(
  operationType: string,
  jobUrl: string,
  jobId: string,
  jobTitle: string,
  status: string
): any {
  let message = 'Your Job (<' + jobUrl + jobId + '|' + jobTitle + '>) ';
  if (operationType === 'insert') {
    message += 'has successfully been added to the queue.';
  } else {
    const newStatus = status;
    if (newStatus === 'inProgress') {
      message += 'is now being processed.';
    } else if (newStatus === 'completed') {
      message += 'has successfully completed.';
    } else if (newStatus === 'failed') {
      message += 'has failed and will not be placed back in the queue.';
    } else {
      message += 'has been updated to an unsupported status.';
    }
  }
  return message;
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
  if (!entitlement || !entitlement['slack_user_id']) {
    consoleLogger.error(username, "Entitlement Failed")
    return;
  }
  const resp = await slackConnector.sendMessage(
    prepProgressMessage(event.detail.operationType, c.get('dashboardUrl'), jobId, jobTitle, event.detail.fullDocument.status),
    entitlement['slack_user_id']
  );
  console.log(resp)
  return {
    'statusCode': 200,
  }
 
};
