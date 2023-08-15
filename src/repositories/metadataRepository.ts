import { Db } from 'mongodb';
import { IConfig } from 'config';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';

/**
 * Manages metadata for parser builds.
 */
export class MetadataRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'MetadataRepository', db.collection('metadata'));
  }

  /**
   * Marks metadata documents for builds to be deleted. Consumers (Gatsby Cloud)
   * of the metadata should handle metadata marked for deletion accordingly.
   * @param project
   * @param branch
   * @param updateTime
   */
  async markMetadataForDeletion(project: string, branch: string, user: string, updateTime: Date) {
    const query = { project, branch, github_username: user };
    const update = {
      $set: {
        deleted: true,
        updated_at: updateTime,
      },
    };

    // We only mark the page ASTs for deletion instead of actually deleting them
    // to let Gatsby Cloud programmatically delete their node data when it fetches
    // page updates
    const success = await this.updateMany(
      query,
      update,
      `Error while marking metadata for ${project}/${branch} for deletion`
    );
    if (!success) {
      const msg = `Could not mark any documents for deletion with project/branch: ${project}/${branch}`;
      this._logger.info(this._repoName, msg);
    }
  }
}
