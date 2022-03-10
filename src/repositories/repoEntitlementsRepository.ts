import { Db } from 'mongodb';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';
import { IConfig } from 'config';

export class RepoEntitlementsRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'RepoEntitlementsRepository', db.collection(config.get('entitlementCollection')));
  }

  async getRepoEntitlementsByGithubUsername(githubUsername: string): Promise<any> {
    const query = { github_username: githubUsername };
    const entitlementsObject = await this.findOne(
      query,
      `Mongo Timeout Error: Timedout while retrieving entitlements for ${githubUsername}`
    );
    // if user has specific entitlements
    if (entitlementsObject?.repos && entitlementsObject.repos.length > 0) {
      return {
        repos: entitlementsObject.repos,
        github_username: entitlementsObject.github_username,
        slack_user_id: entitlementsObject.slack_user_id,
        email: entitlementsObject.email,
        status: 'success',
      };
    } else {
      return { status: 'failure' };
    }
  }

  async getSlackUserIdByGithubUsername(githubUsername: string): Promise<any> {
    const query = { github_username: githubUsername };
    const entitlementsObject = await this.findOne(
      query,
      `Mongo Timeout Error: Timedout while retrieving entitlements for ${githubUsername}`
    );
    // if user has specific entitlements
    if (entitlementsObject?.repos) {
      return {
        github_username: entitlementsObject.github_username,
        slack_user_id: entitlementsObject.slack_user_id,
        email: entitlementsObject.email,
        status: 'success',
      };
    } else {
      return { status: 'failure' };
    }
  }

  async getRepoEntitlementsBySlackUserId(slackUserId: string): Promise<any> {
    const query = { slack_user_id: slackUserId };
    const entitlementsObject = await this.findOne(
      query,
      `Mongo Timeout Error: Timedout while retrieving entitlements for ${slackUserId}`
    );
    // if user has specific entitlements
    if ((entitlementsObject?.repos?.length ?? 0) > 0) {
      return {
        repos: entitlementsObject.repos,
        github_username: entitlementsObject.github_username,
        email: entitlementsObject.email,
        status: 'success',
      };
    } else {
      return { status: 'failure' };
    }
  }
}
