import { Db } from 'mongodb';
import { IConfig } from 'config';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';

/**
 * Manages metadata for parser builds.
 */
export class MetadataRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'MetadataRepository', db.collection(config.get('updatedDocsCollection')));
  }

  /**
   * Marks metadata documents for builds to be deleted. Consumers (Gatsby Cloud)
   * of the metadata should handle metadata marked for deletion accordingly.
   * @param project
   * @param branch
   */
  async marksMetadataForDeletion(project: string, branch: string) {
    const query = { project, branch };
    const update = {
      $set: {
        deleted: true,
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
