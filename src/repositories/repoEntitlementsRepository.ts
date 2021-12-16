import { Db } from 'mongodb';
import { BaseRepository } from "./baseRepository";
import { Job } from "../entities/job"
import { ILogger } from "../services/logger";
import { IConfig } from 'config';

export class RepoEntitlementsRepository extends BaseRepository {

    constructor(db: Db, config: IConfig, logger: ILogger) {
        super(config, logger, "RepoEntitlementsRepository", db.collection(config.get("entitlementCollection")));
    }

    async getRepoEntitlementsByGithubUsername(githubUsername: string): Promise<any> {
        const query = { 'github_username': githubUsername };
        const entitlementsObject = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving entitlements for ${githubUsername}`);
        // if user has specific entitlements
        if (entitlementsObject && entitlementsObject.repos && entitlementsObject.repos.length > 0) {
            return {
                repos: entitlementsObject.repos,
                github_username: entitlementsObject.github_username,
                status: 'success'
            }
        } else {
            return { status: 'failure' };
        }
    }

    async getRepoEntitlementsBySlackUserId(slackUserId: string): Promise<any> {
        const query = { 'user_id': slackUserId };
        const entitlementsObject = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving entitlements for ${slackUserId}`);
        // if user has specific entitlements
        if (entitlementsObject && entitlementsObject.repos && entitlementsObject.repos.length > 0) {
            return {
                repos: entitlementsObject.repos,
                github_username: entitlementsObject.github_username,
                status: 'success'
            }
        } else {
            return { status: 'failure' };
        }
    }
}