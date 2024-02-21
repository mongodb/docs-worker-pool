import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as mongodb from 'mongodb';
import c from 'config';
import { RepoEntitlementsRepository } from '../../../src/repositories/repoEntitlementsRepository';
import { ConsoleLogger } from '../../../src/services/logger';
import { buildEntitledBranchList, isUserEntitled } from '../../handlers/slack';
import { RepoBranchesRepository } from '../../../src/repositories/repoBranchesRepository';

interface TestDeployRequest {
  githubUsername: string;
  repoName: string;
  repoOwner: string;
  branchName?: string;
  directory?: string;
}
export async function handleTestDeployRequest(event: APIGatewayEvent): Promise<APIGatewayProxyResult> {
  const { DB_NAME, JOBS_QUEUE_URL, MONGO_ATLAS_URL } = process.env;

  if (!event.body) {
    return {
      statusCode: 400,
      body: 'Event body is undefined',
    };
  }
  const { githubUsername } = JSON.parse(event.body) as TestDeployRequest;

  if (!MONGO_ATLAS_URL) {
    console.error('MONGO_ATLAS_URL is not defined!');
    return { statusCode: 500, body: 'internal server error' };
  }

  const client = new mongodb.MongoClient(MONGO_ATLAS_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  const consoleLogger = new ConsoleLogger();
  const repoEntitlementRepository = new RepoEntitlementsRepository(db, c, consoleLogger);
  const repoBranchesRepository = new RepoBranchesRepository(db, c, consoleLogger);

  const entitlement = await repoEntitlementRepository.getRepoEntitlementsByGithubUsername(githubUsername);
  if (!isUserEntitled(entitlement)) {
    return {
      statusCode: 401,
      body: 'User is not entitled!',
    };
  }

  return {
    statusCode: 500,
    body: 'not complete',
  };
}
