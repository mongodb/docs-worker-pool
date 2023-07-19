import { Db } from 'mongodb';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';
import { IConfig } from 'config';

export class RepoBranchesRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'RepoEntitlementsRepository', db.collection(config.get('repoBranchesCollection')));
  }

  async getProjectByRepoName(repoName: string) {
    const query = { repoName };
    const projection = { _id: 0, project: 1 };
    return this.findOne(query, `Error while getting project by repo name ${repoName}`, { projection });
  }

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
}
