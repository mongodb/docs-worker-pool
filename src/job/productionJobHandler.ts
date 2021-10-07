import { IConfig } from "config";
import { CDNCreds } from "../entities/creds";
import { IJob } from "../entities/job";
import { InvalidJobError } from "../errors/errors";
import { JobRepository } from "../repositories/jobRepository";
import { ICDNConnector } from "../services/cdn";
import { CommandExecutorResponse, IJobCommandExecutor } from "../services/commandExecutor";
import { IFileSystemServices } from "../services/fileServices";
import { IJobRepoLogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";
import { JobHandler } from "./jobHandler";

export class ProductionJobHandler extends JobHandler {

    constructor(job: IJob, config: IConfig, jobRepository: JobRepository, fileSystemServices: IFileSystemServices, commandExecutor: IJobCommandExecutor,
        cdnConnector: ICDNConnector, repoConnector: IRepoConnector, logger: IJobRepoLogger) {
        super(job, config, jobRepository, fileSystemServices, commandExecutor, cdnConnector, repoConnector, logger);
        this.name = "Production";
    }
    prepDeployCommands(): void {
        this.currJob.deployCommands = [
            '. /venv/bin/activate',
            `cd repos/${this.currJob.payload.repoName}`,
            'make publish && make deploy'
        ];

        if (this.currJob.payload.isNextGen) {
            const manifestPrefix = this.currJob.payload.manifestPrefix;
            this.currJob.deployCommands[this.currJob.deployCommands.length - 1] = `make next-gen-deploy MUT_PREFIX=${this.currJob.payload.mutPrefix}`;
            if (manifestPrefix) {
              const searchFlag = this.currJob.payload.includeInGlobalSearch === true ? "-g" : ""
              this.currJob.deployCommands[this.currJob.deployCommands.length - 1] += ` MANIFEST_PREFIX=${manifestPrefix} GLOBAL_SEARCH_FLAG=${searchFlag}`;
            }
        }
    }

    prepStageSpecificNextGenCommands(): void {
        if (this.currJob && this.currJob.buildCommands) {
            this.currJob.buildCommands[this.currJob.buildCommands.length - 1] = 'make get-build-dependencies';
            this.currJob.buildCommands.push('make next-gen-html');
        }
    }

    async constructManifestIndexPath(): Promise<void> {
        try {
            this.currJob.payload.manifestPrefix = this.currJob.payload.project + '-' + this.currJob.payload.urlSlug;
        } catch (error) {
            await this.logger.save(this.currJob._id, error)
            throw error
        }
    }

    async getPathPrefix(): Promise<string> {
        try {
          let pathPrefix = ""
          pathPrefix = `${this.currJob.payload.prefix}/{$this.currJob.payload.urlSlug}`;
          return pathPrefix;
        } catch (error) {
            await this.logger.save(this.currJob._id, error)
            throw new InvalidJobError(error.message)
        }
    }

    private async purgePublishedContent(makefileOutput: Array<string>): Promise<void> {
        try {
            const stdoutJSON = JSON.parse(makefileOutput[2]);
            //contains URLs corresponding to files updated via our push to S3
            const updatedURLsArray = stdoutJSON.urls;
            // purgeCache purges the now stale content and requests the URLs to warm the cache for our users
            await this.logger.save(this.currJob._id, `${JSON.stringify(updatedURLsArray)}`);
            if (this._config.get("shouldPurgeAll")) {
                await this._cdnConnector.purgeAll(this.getCdnCreds());
            } else {
                await this._cdnConnector.purge(this.currJob._id, updatedURLsArray);
                await this.jobRepository.insertPurgedUrls(this.currJob._id, updatedURLsArray);
            }

        } catch (error) {
            await this.logger.save(this.currJob._id, error);
        }
    }

    private getCdnCreds(): CDNCreds {
        let creds = this._config.get<any>('cdn_creds')['main'];
        if (this.currJob.payload.repoName && this.currJob.payload.repoName in this._config.get<any>('cdn_creds')) {
            creds = this._config.get<any>('cdn_creds')[this.currJob.payload.repoName];
        }
        return new CDNCreds(creds['id'], creds['token']);
    }

    async deploy(): Promise<CommandExecutorResponse> {
        let resp = await this.deployGeneric();
        try {
            const makefileOutput = resp.output.replace(/\r/g, '').split(/\n/);
            await this.purgePublishedContent(makefileOutput);
            await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}Finished pushing to production`);
            await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}Deploy details:\n\n${resp.output}`);
            return resp;
        } catch (errResult) {
            await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
            throw errResult;
        }
    }
}