import { IConfig } from "config";
import { IJob } from "../entities/job";
import { JobRepository } from "../repositories/jobRepository";
import { ICDNConnector } from "../services/cdn";
import { IJobCommandExecutor } from "../services/commandExecutor";
import { IFileSystemServices } from "../services/fileServices";
import { IJobRepoLogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";
import { ProductionJobHandler } from "./productionJobHandler";

export class RegressionJobHandler extends ProductionJobHandler {

    constructor(job: IJob, config: IConfig, jobRepository: JobRepository, fileSystemServices: IFileSystemServices, commandExecutor: IJobCommandExecutor,
        cdnConnector: ICDNConnector, repoConnector: IRepoConnector, logger: IJobRepoLogger) {
            super(job, config, jobRepository, fileSystemServices, commandExecutor, cdnConnector, repoConnector, logger);
            this.name = "Regression";
        }
}