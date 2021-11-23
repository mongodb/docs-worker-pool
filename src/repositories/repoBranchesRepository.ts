import { Db } from 'mongodb';
import { BaseRepository } from "./baseRepository";
import { Job } from "../entities/job"
import { ILogger } from "../services/logger";
import { IConfig } from 'config';

export class RepoBranchesRepository extends BaseRepository<Job> {

    constructor(db: Db, config: IConfig, logger: ILogger) {
        super(config, logger, "RepoEntitlementsRepository", db.collection(config.get("repoBranchesCollection")));
    }

    async getRepoBranchesByRepoName(repoName: string): Promise<any> {
        const query = { 'repoName': repoName };
        const repoDetails = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving Repoinformation for ${repoName}`);
        if (repoDetails && repoDetails.bucket && repoDetails.url) {
            return repoDetails
        } else {
            return { status: 'failure' };
        }
    }
}