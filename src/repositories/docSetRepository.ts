import { IConfig } from 'config';
import { Db } from 'mongodb';
import { ILogger } from '../services/logger';
import { BaseRepository } from './baseRepository';

const docSetCollectionName = process.env.DOCS_SET_COLLECTION_NAME || 'docset';

export class DocSetRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'DocSetRepository', db.collection(docSetCollectionName));
  }

  /**
   * Compares the project path from a monorepo push event, and compares it with
   * what is configured in the docset entry in Atlas.
   * @param path The project path where the snooty.toml file exists from the monorepo.
   * This path will reflect the current project path from a given commit.
   * @param projectName The project name for the docset entry.
   * @returns A boolean representing whether or not the configured docset entry snooty_toml path
   * matches the path found in GitHub.
   */
  async checkSnootyTomlPath(path: string, projectName: string) {
    const query = { project: projectName };
    try {
      const docSetObject = await this.findOne(
        query,
        `Mongo Timeout Error: Timedout while retrieving repos entry for ${path}`
      );

      if (!docSetObject) {
        console.warn(`WARNING: The docset does not exist for the following project: ${projectName} \n path: ${path}`);

        return false;
      }

      return docSetObject.directories.snooty_toml === path;
    } catch (error) {
      console.warn(
        `WARNING: Error occurred when retrieving project path for ${projectName}. The following path was provided: ${path}`,
        error
      );
      return false;
    }
  }
}
