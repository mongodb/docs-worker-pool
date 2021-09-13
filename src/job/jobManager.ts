import { ICDNConnector } from "../services/cdn";
import { IJobRepoLogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";
import { JobRepository } from "../repositories/jobRepository";
import { IConfig } from "config";
import { JobHandler } from "../job/jobHandler";
import { IFileSystemServices } from "../services/fileServices";
import { IJobValidator } from "./jobValidator";
import JobHandlerFactory from "./jobHandlerFactory";
import { IJobCommandExecutor } from "../services/commandExecutor";
import { IJob } from "../entities/job";

export class JobManager {
   private _jobRepository: JobRepository;
   private _cdnConnector: ICDNConnector;
   private _repoConnector: IRepoConnector;
   private _logger: IJobRepoLogger;
   private _shouldStop: boolean;
   private _jobHandler: JobHandler | null | undefined;
   private  _config: IConfig;
   private _fileSystemServices: IFileSystemServices
   private _jobValidator: IJobValidator;
   private  _jobHandlerFactory: JobHandlerFactory;
   private _jobCommandExecutor: IJobCommandExecutor;

    constructor(config: IConfig, jobValidator: IJobValidator, jobHandlerFactory: JobHandlerFactory, jobCommandExecutor: IJobCommandExecutor,
        jobRepository: JobRepository,
        cdnConnector: ICDNConnector, repoConnector: IRepoConnector, fileSystemServices: IFileSystemServices, logger: IJobRepoLogger) {
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
    }

    async start(): Promise<void> {
        this._fileSystemServices.resetDirectory('work/');
        await this.work();
    }

    isStopped(): boolean {
        return this._shouldStop;
    }

    async workEx(): Promise<void> {
        try {
            this._jobHandler = null;
            const job = await this.getQueuedJob();
            if (job) {
                await this.createHandlerAndExecute(job);
            } else {
                this._logger.info("JobManager", `No Jobs Found....: ${new Date()}`);
            }
        } catch (err) {
            this._logger.error("JobManager", `  Error while polling for jobs: ${err}`);
        }
    }

    async getQueuedJob(): Promise<IJob | null> {
        return await this._jobRepository.getOneQueuedJobAndUpdate()
            .catch(error => {
                this._logger.error("JobManager", `Error: ${error}`);
                return null;
            });
    }

    async createHandlerAndExecute(job: IJob): Promise<void> {
        this._jobValidator.throwIfJobInvalid(job);
        this._jobHandler = this._jobHandlerFactory.createJobHandler(job, this._config, this._jobRepository,
            this._fileSystemServices, this._jobCommandExecutor, this._cdnConnector, this._repoConnector, this._logger);
        this._jobHandler?.execute();
        this._logger.save(job._id, `${'    (DONE)'.padEnd(this._config.get("LOG_PADDING"))}Finished Job with ID: ${job._id}`);
    }

    async work():Promise<void> {
        while (!this._shouldStop) {
            await this.workEx();
            await new Promise(resolve => setTimeout(resolve, this._config.get("RETRY_TIMEOUT_MS")));
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