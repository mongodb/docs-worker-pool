import { IConfig } from 'config';
import { BuildJob } from '../entities/job';
import { JobRepository } from '../repositories/jobRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { ICDNConnector } from '../services/cdn';
import { IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { IJobValidator } from './jobValidator';
import { ProductionJobHandler } from './productionJobHandler';

export class RegressionJobHandler extends ProductionJobHandler {
  constructor(
    job: BuildJob,
    cdnConnector: ICDNConnector,
    config: IConfig,
    fileSystemServices: IFileSystemServices,
    jobCommandExecutor: IJobCommandExecutor,
    jobRepository: JobRepository,
    jobValidator: IJobValidator,
    logger: IJobRepoLogger,
    repoBranchesRepo: RepoBranchesRepository,
    repoConnector: IRepoConnector
  ) {
    super(
      job,
      cdnConnector,
      config,
      fileSystemServices,
      jobCommandExecutor,
      jobRepository,
      jobValidator,
      logger,
      repoBranchesRepo,
      repoConnector
    );
    this.name = 'Regression';
  }
}
