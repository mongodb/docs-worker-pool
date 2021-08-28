import { IJob } from "../entities/job";
import { ICDNConnector } from "../services/cdn";
import { ICommandExecutor } from "../services/commandExecutor";
import { IDBConnector } from "../services/db";
import { ILogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";

export abstract class JobHandler {
    protected _currJob: IJob;
    protected _commandExecutor: ICommandExecutor;
    protected _dbConnector: IDBConnector;
    protected _cdnConnector: ICDNConnector;
    protected _repoConnector: IRepoConnector;
    protected _logger: ILogger;
    
    /**
     * ICommandExecutor
     * IDBConnector
     * ICDNConnector
     * IRepoConnector
     * ILogger
     * 
     */
    constructor (job: IJob, commandExecutor: ICommandExecutor, dbConnector: IDBConnector, cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: ILogger) {
        this._commandExecutor = commandExecutor;
        this._dbConnector = dbConnector;
        this._cdnConnector = cdnConnector;
        this._repoConnector = repoConnector;
        this._logger = logger;
        this._currJob = job
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