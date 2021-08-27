import { ICDNConnector } from "./services/cdn";
import { ICommandExecutor } from "./services/commandExecutor";
import { IDBConnector } from "./services/db";
import { ILogger } from "./services/logger";
import { IRepoConnector } from "./services/repo";

export class JobManager {
    _commandExecutor: ICommandExecutor;
    _dbConnector: IDBConnector;
    _cdnConnector: ICDNConnector;
    _repoConnector: IRepoConnector;
    _logger: ILogger;

    constructor(commandExecutor: ICommandExecutor, dbConnector: IDBConnector, 
        cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: ILogger) {
            this._commandExecutor = commandExecutor;
            this._dbConnector = dbConnector;
            this._cdnConnector = cdnConnector;
            this._repoConnector = repoConnector;
            this._logger = logger;
    }
   
    async start() : Promise<void> {

        /**
         * Start Polling for the jobs, 
         * as you find job use job factory to create appropriate job handler 
         * Call the execute method of the job handler. 
         * 
         */

    }

    async stop() : Promise<void> {

    }

    async startLocal() : Promise<void> {

    }
  }