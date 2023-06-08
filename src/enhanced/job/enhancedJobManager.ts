import { IConfig } from 'config';
import { InvalidJobError } from '../../errors/errors';
import { JobHandler } from '../../job/jobHandler';
import { IJobValidator } from '../../job/jobValidator';
import { JobRepository } from '../../repositories/jobRepository';
import { RepoBranchesRepository } from '../../repositories/repoBranchesRepository';
import { ICDNConnector } from '../../services/cdn';
import { IJobCommandExecutor } from '../../services/commandExecutor';
import { IFileSystemServices } from '../../services/fileServices';
import { IJobRepoLogger } from '../../services/logger';
import { IRepoConnector } from '../../services/repo';
import { Job } from '../../entities/job';
import {
  EnhancedStagingJobHandler,
  EnhancedManifestJobHandler,
  EnhancedProductionJobHandler,
  EnhancedRegressionJobHandler,
} from './enhancedJobHandlers';

export const enhancedJobHandlerMap = {
  githubPush: EnhancedStagingJobHandler,
  manifestGeneration: EnhancedManifestJobHandler,
  productionDeploy: EnhancedProductionJobHandler,
  regression: EnhancedRegressionJobHandler,
};

export class EnhancedJobHandlerFactory {
  public createJobHandler(
    job: Job,
    config: IConfig,
    jobRepository: JobRepository,
    fileSystemServices: IFileSystemServices,
    commandExecutor: IJobCommandExecutor,
    cdnConnector: ICDNConnector,
    repoConnector: IRepoConnector,
    logger: IJobRepoLogger,
    validator: IJobValidator,
    repoBranchesRepo: RepoBranchesRepository
  ): JobHandler {
    const jt = job.payload?.jobType;
    if (jt in enhancedJobHandlerMap) {
      return new enhancedJobHandlerMap[jt](
        job,
        config,
        jobRepository,
        fileSystemServices,
        commandExecutor,
        cdnConnector,
        repoConnector,
        logger,
        validator,
        repoBranchesRepo
      );
    }
    throw new InvalidJobError('Job type not supported');
  }
}
