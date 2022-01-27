import { JobHandler } from './jobHandler';
import { ManifestJobHandler } from './manifestJobHandler';
import { ProductionJobHandler } from './productionJobHandler';
import { RegressionJobHandler } from './regressionJobHandler';
import { StagingJobHandler } from './stagingJobHandler';
import { ICDNConnector } from '../services/cdn';
import { IConfig } from 'config';
import { IFileSystemServices } from '../services/fileServices';
import { IJob } from '../entities/job';
import { IJobCommandExecutor } from '../services/commandExecutor';
import { IJobRepoLogger } from '../services/logger';
import { IJobValidator } from './jobValidator';
import { InvalidJobError } from '../errors/errors';
import { IRepoConnector } from '../services/repo';
import { JobRepository } from '../repositories/jobRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';

export class JobHandlerFactory {
  public createJobHandler(
    job: IJob,
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
    switch (job.payload?.jobType) {
      case 'regression':
        return new RegressionJobHandler(
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
      case 'githubPush':
        return new StagingJobHandler(
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
      case 'productionDeploy':
        return new ProductionJobHandler(
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
      case 'manifestGeneration':
        return new ManifestJobHandler(
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
      default:
        throw new InvalidJobError(`Job type '${job.payload?.jobType}' not supported`);
    }
  }
}

export class JobManager {
  private _jobRepository: JobRepository;
  private _cdnConnector: ICDNConnector;
  private _repoConnector: IRepoConnector;
  private _logger: IJobRepoLogger;
  private _shouldStop: boolean;
  private _jobHandler: JobHandler | null | undefined;
  private _config: IConfig;
  private _fileSystemServices: IFileSystemServices;
  private _jobValidator: IJobValidator;
  private _jobHandlerFactory: JobHandlerFactory;
  private _jobCommandExecutor: IJobCommandExecutor;
  private _repoBranchesRepo: RepoBranchesRepository;

  constructor(
    config: IConfig,
    jobValidator: IJobValidator,
    jobHandlerFactory: JobHandlerFactory,
    jobCommandExecutor: IJobCommandExecutor,
    jobRepository: JobRepository,
    cdnConnector: ICDNConnector,
    repoConnector: IRepoConnector,
    fileSystemServices: IFileSystemServices,
    logger: IJobRepoLogger,
    repoBranchesRepo: RepoBranchesRepository
  ) {
    this._jobRepository = jobRepository;
    this._cdnConnector = cdnConnector;
    this._repoConnector = repoConnector;
    this._logger = logger;
    this._shouldStop = false;
    this._jobHandler = null;
    this._config = config;
    this._fileSystemServices = fileSystemServices;
    this._jobValidator = jobValidator;
    this._jobHandlerFactory = jobHandlerFactory;
    this._jobCommandExecutor = jobCommandExecutor;
    this._repoBranchesRepo = repoBranchesRepo;
  }

  async start(): Promise<void> {
    this._fileSystemServices.resetDirectory('work/');
    await this.work();
  }

  async startSpecificJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await this.workEx(job);
    } else {
      this._logger.error(jobId, 'Unable to find the job to execute');
    }
  }

  isStopped(): boolean {
    return this._shouldStop;
  }

  async workEx(job: IJob): Promise<void> {
    try {
      this._jobHandler = null;
      if (job?.payload) {
        await this.createHandlerAndExecute(job);
      } else {
        this._logger.info('JobManager', `No Jobs Found....: ${new Date()}`);
      }
    } catch (err) {
      this._logger.error('JobManager', `  Error while polling for jobs: ${err}`);
      if (job) {
        await this._jobRepository.updateWithErrorStatus(job._id, err);
      }
    }
  }

  async getQueuedJob(): Promise<IJob | null> {
    return await this._jobRepository.getOneQueuedJobAndUpdate().catch((error) => {
      this._logger.error('JobManager', `Error: ${error}`);
      return null;
    });
  }

  async getJob(jobId: string): Promise<IJob | null> {
    return await this._jobRepository.getJobByIdAndUpdate(jobId).catch((error) => {
      this._logger.error('JobManager', `Error: ${error}`);
      return null;
    });
  }

  async createHandlerAndExecute(job: IJob): Promise<void> {
    this._jobHandler = this._jobHandlerFactory.createJobHandler(
      job,
      this._config,
      this._jobRepository,
      this._fileSystemServices,
      this._jobCommandExecutor,
      this._cdnConnector,
      this._repoConnector,
      this._logger,
      this._jobValidator,
      this._repoBranchesRepo
    );

    await this._jobValidator.throwIfJobInvalid(job);
    await this._jobHandler?.execute();
    await this._logger.save(
      job._id,
      `${'    (DONE)'.padEnd(this._config.get('LOG_PADDING'))}Finished Job with ID: ${job._id}`
    );
  }

  async work(): Promise<void> {
    while (!this._shouldStop) {
      const job = await this.getQueuedJob();
      if (job) {
        await this.workEx(job);
      }
      await new Promise((resolve) => setTimeout(resolve, this._config.get('RETRY_TIMEOUT_MS')));
    }
  }

  async stop(): Promise<void> {
    this._logger.info('JobManager', '\nServer is starting cleanup');
    this._shouldStop = true;
    this._jobHandler?.stop();
    await this._jobHandler?.jobRepository.resetJobStatus(
      this._jobHandler?.currJob._id,
      'inQueue',
      `Resetting Job with ID: ${this._jobHandler?.currJob._id} because server is being shut down`
    );
  }
}
