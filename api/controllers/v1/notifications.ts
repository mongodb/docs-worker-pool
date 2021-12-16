import c from "config";
import mongodb from "mongodb";
import { RepoEntitlementsRepository } from "../../../src/repositories/repoEntitlementsRepository";
import { ConsoleLogger } from "../../../src/services/logger";
import { SlackConnector } from "../../../src/services/slack"

export const NotifyBuildSummary = async (event: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  if (JSON.stringify(event.updateDescription.updatedFields).indexOf('comMessage') === -1) {
    return;
  }
  const slackMsgs = event.fullDocument.comMessage;
  // check if summary exists to send to slack 
  if (slackMsgs === undefined || slackMsgs.length === 0) {
    consoleLogger.error(event.fullDocument._id, 'ERROR: Empty slack message array.');
    return;
  }

  const jobTitle = event.fullDocument.title;
  const jobId = event.fullDocument._id;
  const repoName = event.fullDocument.payload.repoName;
  const username = event.fullDocument.user;
  const slackConnector = new SlackConnector(consoleLogger, c)
  let client = new mongodb.MongoClient(c.get("dbUrl"));
  await client.connect();
  const db = client.db(c.get("dbName"));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement || !entitlement["slack_user_id"]) {
    return
  }
  return await slackConnector.sendMessage(prepSummaryMessage(repoName, slackMsgs[slackMsgs.length - 1], c.get<string>("dashboardUrl"), jobId, jobTitle), 
  entitlement["slack_user_id"]);
}

function prepSummaryMessage(repoName:string, lastMessage: string, jobUrl: string, jobId: string, jobTitle: string): string {
  if (repoName === 'mms-docs') {
    let modMmsOutput: string;
    modMmsOutput = lastMessage.substr(0, lastMessage.indexOf('mut-publish'));
    modMmsOutput = modMmsOutput + '\n\n';
    modMmsOutput = modMmsOutput + lastMessage.substr(lastMessage.lastIndexOf('Summary'));
    lastMessage = modMmsOutput;
  }
  let message = "Your Job (<" + jobUrl + jobId + "|" + jobTitle + ">) ";
  message += "finished! Please check the build log for any errors";
  // only get the summary portion of build output
  message += '\n' + lastMessage;
  message += '\n' + "Enjoy!";
  message = message.replace(/\.{2,}/g, '');
  return message;
}

function prepProgressMessage(operationType: string, jobUrl: string, jobId: string, jobTitle: string, status: string): any {
  let message = "Your Job (<" + jobUrl + jobId + "|" + jobTitle + ">) ";
  if (operationType === "insert") {
    message += "has successfully been added to the queue.";
  } else {
    let newStatus = status;
    if (newStatus === "inProgress") {
      message += "is now being processed.";
    } else if (newStatus === "completed") {
      message += "has successfully completed.";
    } else if (newStatus === "failed") {
      message += "has failed and will not be placed back in the queue.";
    } else {
      message += "has been updated to an unsupported status.";
    }
  }
  return message;
}

export const NotifyBuildProgress = async (event: any = {}): Promise<any> => {
  const consoleLogger = new ConsoleLogger();
  const slackConnector = new SlackConnector(consoleLogger, c)
  const jobTitle = event.fullDocument.title;
  const jobId = event.fullDocument._id;
  const username = event.fullDocument.user;
  let client = new mongodb.MongoClient(c.get("dbUrl"));
  await client.connect();
  const db = client.db(c.get("dbName"));
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(username);
  if (!entitlement || !entitlement["slack_user_id"]) {
    return
  }
  return await slackConnector.sendMessage(prepProgressMessage(event.operationType, c.get("dashboardUrl"), jobId, jobTitle, status), entitlement["slack_user_id"]);
}