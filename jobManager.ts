import { ICDNConnector } from "./services/cdn";
import { IJobRepoLogger, ILogger } from "./services/logger";
import { IRepoConnector } from "./services/repo";
import { JobRepository } from "./repositories/jobRepository";
import { RepoEntitlementsRepository } from "./repositories/repoEntitlementsRepository";
import { IConfig } from "config";
import { JobHandler } from "./job/jobHandler";
import { IFileSystemServices } from "./services/fileServices";
import { IJobValidator } from "./job/jobValidator";
import { JobFactory } from "./job/jobFactory";
import { ICommandExecutor, IJobCommandExecutor } from "./services/commandExecutor";

export class JobManager {
    _jobRepository: JobRepository;
    _repoEntitlementRepository; RepoEntitlementsRepository;
    _cdnConnector: ICDNConnector;
    _repoConnector: IRepoConnector;
    _logger: IJobRepoLogger;
    _shouldStop: boolean;
    _jobHandler: JobHandler | null | undefined;
    _config: IConfig;
    _fileSystemServices: IFileSystemServices
    _jobValidator: IJobValidator;
    _jobFactory: JobFactory;
    _jobCommandExecutor: IJobCommandExecutor;

    constructor(config: IConfig, jobValidator: IJobValidator, jobFactory: JobFactory, jobCommandExecutor: IJobCommandExecutor,
        jobRepository: JobRepository, repoEntitlementRepository: RepoEntitlementsRepository,
        cdnConnector: ICDNConnector, repoConnector: IRepoConnector, fileSystemServices: IFileSystemServices, logger: IJobRepoLogger) {
        this._jobRepository = jobRepository;
        this._repoEntitlementRepository = repoEntitlementRepository;
        this._cdnConnector = cdnConnector;
        this._repoConnector = repoConnector;
        this._logger = logger;
        this._shouldStop = false;
        this._jobHandler = null;
        this._config = config;
        this._fileSystemServices = fileSystemServices;
        this._jobValidator = jobValidator;
        this._jobFactory = jobFactory;
        this._jobCommandExecutor = jobCommandExecutor;
    }

    async start(): Promise<void> {
        this._fileSystemServices.resetDirectory('work/');
        await this.work();
    }

    async work() {
        while (!this._shouldStop) {
            try {
                this._jobHandler = null;
                if (this._shouldStop) {
                    this._logger.info("JobManager", 'shutting down');
                    throw new Error('Shutting Down --> Should not get new jobs');
                }
                const job = await this._jobRepository.getOneQueuedJobAndUpdate()
                    .catch(error => {
                        this._logger.error("JobManager", `Error: ${error}`);
                    });

                if (job) {
                    this._jobValidator.throwIfJobInvalid(job);
                    this._jobHandler = this._jobFactory.createJobHandler(job, this._config, this._jobRepository,
                        this._fileSystemServices, this._jobCommandExecutor, this._cdnConnector, this._repoConnector, this._logger);
                    this._jobHandler.execute();
                    this._logger.save(job._id, `${'    (DONE)'.padEnd(this._config.get("LOG_PADDING"))}Finished Job with ID: ${job._id}`);

                } else {
                    this._logger.info("JobManager", `No Jobs Found....: ${new Date()}`);
                }
            } catch (err) {
                this._logger.error("JobManager", `  Error while polling for jobs: ${err}`);
            }
            await new Promise(resolve => setTimeout(resolve, this._config.get("RETRY_TIMEOUT_MS")))
        }
    }

    async stop(): Promise<void> {
        this._logger.info("JobManager", '\nServer is starting cleanup');
        this._shouldStop = true;
        this._jobHandler?.stop();
    }
    async startLocal(): Promise<void> {

    }
}