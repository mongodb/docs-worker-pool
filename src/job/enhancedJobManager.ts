import { IConfig } from 'config';
import { JobRepository } from '../repositories/jobRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { ICDNConnector } from '../services/cdn';
import { IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { JobHandlerFactory, JobManager } from './jobManager';
import { IJobValidator } from './jobValidator';
import { Job } from '../entities/job';
import { EnhancedJobRepository } from '../repositories/enhancedJobRepository';

export class EnhancedJobManager extends JobManager {
  private _cleanUp: () => Promise<void>;
  constructor(
    config: IConfig,
    jobValidator: IJobValidator,
    jobHandlerFactory: JobHandlerFactory,
    jobCommandExecutor: IJobCommandExecutor,
    jobRepository: EnhancedJobRepository,
    cdnConnector: ICDNConnector,
    repoConnector: IRepoConnector,
    fileSystemServices: IFileSystemServices,
    logger: IJobRepoLogger,
    repoBranchesRepo: RepoBranchesRepository,
    cleanUp: () => Promise<void>
  ) {
    super(
      config,
      jobValidator,
      jobHandlerFactory,
      jobCommandExecutor,
      jobRepository,
      cdnConnector,
      repoConnector,
      fileSystemServices,
      logger,
      repoBranchesRepo
    );
    this._cleanUp = cleanUp;
  }

  override async work() {
    while (true) {
      const job = await this.getQueuedJob();
      if (job) {
        await this.workEx(job);
        await this._cleanUp();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, this._config.get('RETRY_TIMEOUT_MS')));
    }
  }
}
