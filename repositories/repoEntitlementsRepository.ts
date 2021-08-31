import { Db } from 'mongodb';
import { BaseRepository } from "./BaseRepository";
import { Job } from "../entities/job"
import { ILogger } from "../services/logger";
import { IConfig } from 'config';

export class RepoEntitlementsRepository extends BaseRepository<Job> {

    constructor(db: Db, config: IConfig, logger: ILogger) {
        super(db, config, logger);
        this._repoName = "RepoEntitlementsRepository";
    }

    async getRepoEntitlementsByGithubUsername(githubUsername: string): Promise<any> {
        const query = { 'github_username': githubUsername };
        const entitlementsObject = await this.findOne(query, `Timedout while retrieving entitlements for ${githubUsername}`);
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