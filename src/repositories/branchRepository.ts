import { Db } from 'mongodb';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';
import { IConfig } from 'config';

export class BranchRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'BranchRepository', db.collection(config.get('repoBranchesCollection')));
  }

  async getRepoBranches(repoName: string): Promise<any> {
    console.log('getRepoBranches', repoName);
    const query = { repoName: repoName };
    const repo = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving branches for ${repoName}`);
    console.log(repo);
    // if user has specific entitlements
    return repo?.['branches'] ?? [];
  }

  async getRepo(repoName: string): Promise<any> {
    const query = { repoName: repoName };
    const repo = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving branches for ${repoName}`);
    // if user has specific entitlements
    return repo;
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
