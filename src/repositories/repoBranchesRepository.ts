import { Db } from 'mongodb';
import { BaseRepository } from "./baseRepository";
import { Job } from "../entities/job"
import { ILogger } from "../services/logger";
import { IConfig } from 'config';

export class RepoBranchesRepository extends BaseRepository<Job> {

    constructor(db: Db, config: IConfig, logger: ILogger) {
        super(config, logger, "RepoBranchesRepository", db.collection(config.get("reposBranchesCollection")));
    }

    async getConfiguredBranchesByGithubRepoName(repoName: string): Promise<any> {
        const query = { 'repoName': repoName };
        const reposObject = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving repos entry for ${repoName}`);
        // if user has specific entitlements
        if (reposObject && reposObject.branches) {
            return {
                branches: reposObject.branches,
                repoName: reposObject.repoName,
                status: 'success'
            }
        } else {
            return { status: 'failure' };
        }
    }
}