import { Db } from 'mongodb';
import { IConfig } from 'config';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';

/**
 * Manages metadata for parser builds.
 */
export class ProjectsRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'ProjectsRepository', db.collection('projects'));
  }

  async getProjectEntry(name: string): Promise<any> {
    const query = { name: name };
    const projectEntry = await this.findOne(
      query,
      `Mongo Timeout Error: Timedout while retrieving branches for ${name}
      }`
    );
    // if user has specific entitlements
    return projectEntry;
  }

  static getGithuRepoUrl(repoOwner: string, repoName: string): string {
    return 'https://github.com/' + repoOwner + '/' + repoName;
  }
}
