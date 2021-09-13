import {ICDNConnector } from "../services/cdn"
import { ProductionJobHandler } from "./productionJobHandler";
import { RegressionJobHandler } from "./regressionJobHandler";
import { StagingJobHandler } from "./stagingJobHandler";
import { IRepoConnector } from "../services/repo";
import { IJobRepoLogger } from "../services/logger";
import { JobHandler } from "./jobHandler";
import { IJobCommandExecutor } from "../services/commandExecutor";
import { InvalidJobError } from "../errors/errors";
import { IJob } from "../entities/job";
import { JobRepository } from "../repositories/jobRepository";
import { IFileSystemServices } from "../services/fileServices";
import { IConfig } from "config";

export default class JobHandlerFactory {
    public createJobHandler(job: IJob,  config: IConfig, jobRepository:JobRepository, fileSystemServices:IFileSystemServices, commandExecutor: IJobCommandExecutor, cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: IJobRepoLogger) : JobHandler {
        if (job.payload.jobType === "regression") {
            return new RegressionJobHandler(job, config, jobRepository, fileSystemServices, commandExecutor, cdnConnector, repoConnector, logger);
        } else if (job.payload.jobType === "githubPush") {
            return new StagingJobHandler(job, config, jobRepository, fileSystemServices, commandExecutor, cdnConnector, repoConnector, logger);
        } else if (job.payload.jobType === "productionDeploy") {
            return new ProductionJobHandler(job, config, jobRepository, fileSystemServices, commandExecutor, cdnConnector, repoConnector, logger);
        }
        throw new InvalidJobError("Job type not supported");
    }
}