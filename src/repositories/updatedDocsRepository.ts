import { Db } from 'mongodb';
import { IConfig } from 'config';
import { BaseRepository } from './baseRepository';
import { ILogger } from '../services/logger';

/**
 * Manages updated/persistent page ASTs for individual projects and branches.
 */
export class UpdatedDocsRepository extends BaseRepository {
  constructor(db: Db, config: IConfig, logger: ILogger) {
    super(config, logger, 'UpdatedDocsRepository', db.collection('updated_documents'));
  }

  /**
   * Marks page ASTs to be deleted. Consumers (Gatsby Cloud) of the ASTs should
   * handle page documents marked for deletion accordingly.
   * @param project
   * @param branch
   */
  async marksAstsForDeletion(project: string, branch: string) {
    const pageIdPrefix = `${project}/docsworker-xlarge/${branch}`;
    const query = {
      page_id: { $regex: new RegExp(`^${pageIdPrefix}/`) },
    };
    const update = {
      $set: {
        deleted: true,
        updated_at: new Date(),
      },
    };

    // We only mark the page ASTs for deletion instead of actually deleting them
    // to let Gatsby Cloud programmatically delete their node data when it fetches
    // page updates
    const success = await this.updateMany(
      query,
      update,
      `Error while marking AST data for ${pageIdPrefix} for deletion`
    );
    if (!success) {
      const msg = `Could not mark any documents for deletion with page_id prefix: ${pageIdPrefix}`;
      this._logger.info(this._repoName, msg);
    }
  }
}
