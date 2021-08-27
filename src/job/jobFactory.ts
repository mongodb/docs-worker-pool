import { IDBConnector } from "../services/db";
import {ICDNConnector } from "../services/cdn"
import { ProductionJobHandler } from "./productionJobHandler";
import { RegressionJobHandler } from "./regressionJobHandler";
import { StagingJobHandler } from "./stagingJobHandler";
import { IRepoConnector } from "../services/repo";
import { ILogger } from "../services/logger";
import { IJob, JobHandler } from "./job";
import { ICommandExecutor } from "../services/commandExecutor";
import { InvalidJobError } from "../errors/errors";

export class JobFactory {
    public createJobHandler(job: IJob, commandExecutor: ICommandExecutor, dbConnector: IDBConnector, 
        cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: ILogger) : JobHandler {
        if (job.jobType === "regression") {
            return new RegressionJobHandler(job, commandExecutor, dbConnector, cdnConnector, repoConnector, logger);
        } else if (job.jobType === "githubPush") {
            return new StagingJobHandler(job, commandExecutor, dbConnector, cdnConnector, repoConnector, logger);
        } else if (job.jobType === "productionDeploy") {
            return new ProductionJobHandler(job, commandExecutor, dbConnector, cdnConnector, repoConnector, logger);
        }
        throw new InvalidJobError("Job type not supported");
    }
}