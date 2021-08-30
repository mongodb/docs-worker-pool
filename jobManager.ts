import { ICDNConnector } from "./services/cdn";
import { IJobRepoLogger, ILogger } from "./services/logger";
import { IRepoConnector } from "./services/repo";
import { JobRepository } from "./repositories/jobRepository";
import { RepoEntitlementsRepository } from "./repositories/repoEntitlementsRepository";
export class JobManager {
    _jobRepository: JobRepository;
    _repoEntitlementRepository; RepoEntitlementsRepository;
    _cdnConnector: ICDNConnector;
    _repoConnector: IRepoConnector;
    _logger: IJobRepoLogger;

    constructor(jobRepository: JobRepository, 
        repoEntitlementRepository: RepoEntitlementsRepository,
        cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: IJobRepoLogger) {
            this._jobRepository = jobRepository;
            this._repoEntitlementRepository = repoEntitlementRepository;
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