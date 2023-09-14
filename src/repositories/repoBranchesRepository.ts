import { Db } from 'mongodb';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';
import { IConfig } from 'config';

export class RepoBranchesRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'RepoBranchesRepository', db.collection(config.get('repoBranchesCollection')));
  }

  // TODO: delete???
  async getConfiguredBranchesByGithubRepoName(repoName: string): Promise<any> {
    const query = { repoName: repoName };
    const reposObject = await this.findOne(
      query,
      `Mongo Timeout Error: Timedout while retrieving repos entry for ${repoName}`
    );
    if (reposObject?.branches) {
      return {
        branches: reposObject.branches,
        repoName: reposObject.repoName,
        status: 'success',
      };
    } else {
      return { status: 'failure' };
    }
  }

  // TODO: change query
  async getProjectByRepoName(repoName: string) {
    const query = { repoName };
    const projection = { _id: 0, project: 1 };
    const res = await this.findOne(query, `Error while getting project by repo name ${repoName}`, { projection });
    return res.project;
  }

  // TODO: change to full
  async getRepo(repoName: string): Promise<any> {
    const query = { repoName: repoName };
    const repo = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving branches for ${repoName}`);
    // if user has specific entitlements
    return repo;
  }

  async getRepoBranches(repoName: string): Promise<any> {
    const query = { repoName: repoName };
    const repo = await this.findOne(query, `Mongo Timeout Error: Timedout while retrieving branches for ${repoName}`);
    // if user has specific entitlements
    return repo?.['branches'] ?? [];
  }

  // TODO: change to full
  async getRepoBranchesByRepoName(repoName: string): Promise<any> {
    const query = { repoName: repoName };
    const repoDetails = await this.findOne(
      query,
      `Mongo Timeout Error: Timedout while retrieving repo information for ${repoName}`
    );

    if (repoDetails?.bucket && repoDetails?.url) {
      return repoDetails;
    } else {
      return { status: 'failure' };
    }
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
