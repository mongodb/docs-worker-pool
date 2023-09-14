import { Db } from 'mongodb';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';
import { IConfig } from 'config';

export class RepoBranchesRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'RepoBranchesRepository', db.collection(config.get('repoBranchesCollection')));
  }

  async getRepoBranches(repoName: string): Promise<any> {
    const query = { repoName: repoName };
    const repo = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving branches for ${repoName}`);
    // if user has specific entitlements
    return repo?.['branches'] ?? [];
  }

  async getRepoBranchAliases(repoName: string, branchName: string): Promise<any> {
    const returnObject = { status: 'failure' };
    const aliasArray = await this._collection
      .aggregate([
        { $match: { repoName: repoName } },
        { $unwind: '$branches' },
        { $match: { 'branches.gitBranchName': branchName } },
        { $project: { branches: 1 } },
      ])
      .toArray();

    if (aliasArray.length === 1) {
      returnObject['aliasObject'] = aliasArray[0].branches;
      returnObject.status = 'success';
    }
    return returnObject;
  }
}
