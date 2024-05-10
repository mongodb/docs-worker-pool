import mongodb from 'mongodb';
import { IConfig } from 'config';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';

//Project information from docs_metadata.projects for parser builds.

export class ProjectsRepository extends BaseRepository {
  constructor(db: mongodb.Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'ProjectsRepository', db.collection(process.env.PROJECTS_COL_NAME || 'projects'));
  }

  async getProjectEntry(name: string): Promise<mongodb.WithId<mongodb.BSON.Document> | null> {
    const query = { name: name };
    const projectEntry = await this.findOne(
      query,
      `Mongo Timeout Error: Timed out while retrieving branches for ${name}
      }`
    );
    return projectEntry;
  }
}
