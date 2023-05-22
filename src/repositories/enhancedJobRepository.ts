import mongodb from 'mongodb';
import { JobRepository } from './jobRepository';
import { IConfig } from 'config';
import { ILogger } from '../services/logger';
import { Job } from '../entities/job';

export class EnhancedJobRepository extends JobRepository {
  constructor(db: mongodb.Db, config: IConfig, logger: ILogger, collectionName: string | null = null) {
    super(db, config, logger, collectionName);
  }

  override async getOneQueuedJobAndUpdate(): Promise<Job | null> {
    const query = {
      status: 'inQueue',
      createdTime: { $lte: new Date() },
      type: 'enhanced',
    };
    return this.findOneAndUpdateJob(query);
  }
}
