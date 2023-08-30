import { IConfig } from 'config';
import { Db } from 'mongodb';
import { ILogger } from '../services/logger';
import { BaseRepository } from './baseRepository';

export class DocSetRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'DocSetRepository', db.collection(config.get('docSetCollection')));
  }

  async checkSnootyTomlPath(path: string, projectName: string) {
    const query = { directories: { snooty_toml: path } };

    try {
      const docSetObject = await this.findOne(
        query,
        `Mongo Timeout Error: Timedout while retrieving repos entry for ${path}`
      );

      return !!docSetObject;
    } catch (error) {
      console.warn(`WARNING: Snooty.toml path: ${path}, is not configured in the docsets collection. Please update.`);
      return false;
    }
  }
}
