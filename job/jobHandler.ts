import { IJob } from "../entities/job";
import { JobRepository } from "../repositories/jobRepository";
import { RepoEntitlementsRepository } from "../repositories/repoEntitlementsRepository";
import { ICDNConnector } from "../services/cdn";
import { ICommandExecutor } from "../services/commandExecutor";
import { ILogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";

export abstract class JobHandler {
    protected _currJob: IJob;
    protected _commandExecutor: ICommandExecutor;
    protected _cdnConnector: ICDNConnector;
    protected _repoConnector: IRepoConnector;
    protected _logger: ILogger;
    protected _jobRepository: JobRepository;
    
    /**
     * ICommandExecutor
     * IDBConnector
     * ICDNConnector
     * IRepoConnector
     * ILogger
     * 
     */
    constructor (job: IJob, jobRepository:JobRepository, commandExecutor: ICommandExecutor, 
        cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: ILogger) {
        this._commandExecutor = commandExecutor;
        this._cdnConnector = cdnConnector;
        this._repoConnector = repoConnector;
        this._logger = logger;
        this._currJob = job;
        this._jobRepository = jobRepository;
    }

    abstract prepCommands():  Promise<string[]>;

    async execute(): Promise<void> {
        await this.prepCommands()
        await this.build()
        await this.publish()
        await this.update()
    }

    async build(): Promise<void> {
        /**
         * Clone the repo
         * Pull the repo
         */
    }

    abstract publish(): Promise<void>;
    async update(): Promise<void> {
    }

}