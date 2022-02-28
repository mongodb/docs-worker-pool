import { IConfig } from 'config';
import { CDNCreds } from '../entities/creds';
import { BuildJob } from '../entities/job';
import { InvalidJobError } from '../errors/errors';
import { JobRepository } from '../repositories/jobRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { ICDNConnector } from '../services/cdn';
import { CommandExecutorResponse, IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { JobHandler } from './jobHandler';
import { IJobValidator } from './jobValidator';

export class ProductionJobHandler extends JobHandler {
  constructor(
    job: BuildJob,
    cdnConnector: ICDNConnector,
    config: IConfig,
    fileSystemServices: IFileSystemServices,
    jobCommandExecutor: IJobCommandExecutor,
    jobRepository: JobRepository,
    jobValidator: IJobValidator,
    logger: IJobRepoLogger,
    repoBranchesRepo: RepoBranchesRepository,
    repoConnector: IRepoConnector
  ) {
    super(
      job,
      cdnConnector,
      config,
      fileSystemServices,
      jobCommandExecutor,
      jobRepository,
      jobValidator,
      logger,
      repoBranchesRepo,
      repoConnector
    );
    this.name = 'Production';
  }
  prepDeployCommands(): void {
    // TODO: Can we simplify the chain of logic here?
    this.job.deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.job.payload.repoName}`,
      'make publish && make deploy',
    ];

    if (this.job.payload.isNextGen) {
      this.job.deployCommands[
        this.job.deployCommands.length - 1
      ] = `make next-gen-deploy MUT_PREFIX=${this.job.payload.mutPrefix}`;
      // TODO: Remove functionality of manifestPrefix
      const manifestPrefix = this.job.payload.manifestPrefix;
      if (manifestPrefix) {
        const searchFlag = this.job.payload.stable;
        this.job.deployCommands[
          this.job.deployCommands.length - 1
        ] += ` MANIFEST_PREFIX=${manifestPrefix} GLOBAL_SEARCH_FLAG=${searchFlag}`;
      }
    }
  }

  prepStageSpecificNextGenCommands(): void {
    if (this.job?.buildCommands) {
      this.job.buildCommands[this.job.buildCommands.length - 1] = 'make get-build-dependencies';
      this.job.buildCommands.push('make next-gen-html');
    }
  }

  getActiveBranchLength(): number {
    return this.job.payload.repoBranches.branches.filter((b) => b['active']).length;
  }

  async constructManifestIndexPath(): Promise<void> {
    try {
      this.job.payload.manifestPrefix = `${this.job.payload.project}-${this.job.payload.urlSlug}`;
    } catch (error) {
      await this.logger.save(this.job._id, error);
      throw error;
    }
  }

  getPathPrefix(): string {
    try {
      if (this.job.payload.prefix && this.job.payload.prefix === '') {
        return this.job.payload.urlSlug ?? '';
      }
      return `${this.job.payload.prefix}/${this.job.payload.urlSlug}`;
    } catch (error) {
      this.logger.save(this.job._id, error).then();
      throw new InvalidJobError(error.message);
    }
  }

  private async purgePublishedContent(makefileOutput: Array<string>): Promise<void> {
    try {
      const stdoutJSON = JSON.parse(makefileOutput[2]);
      //contains URLs corresponding to files updated via our push to S3
      const updatedURLsArray = stdoutJSON.urls;
      // purgeCache purges the now stale content and requests the URLs to warm the cache for our users
      await this.logger.save(this.job._id, JSON.stringify(updatedURLsArray));
      if (this._config.get('shouldPurgeAll')) {
        await this._cdnConnector.purgeAll(this.getCdnCreds());
      } else {
        await this._cdnConnector.purge(this.job._id, updatedURLsArray);
        await this.jobRepository.insertPurgedUrls(this.job._id, updatedURLsArray);
      }
    } catch (error) {
      await this.logger.save(this.job._id, error);
    }
  }

  private getCdnCreds(): CDNCreds {
    let creds = this._config.get<any>('cdn_creds')['main'];
    if (this.job?.payload?.repoName in this._config.get<any>('cdn_creds')) {
      creds = this._config.get<any>('cdn_creds')[this.job.payload.repoName];
    }
    return new CDNCreds(creds['id'], creds['token']);
  }

  async deploy(): Promise<CommandExecutorResponse> {
    try {
      const resp = await this.deployGeneric();
      if (resp?.output) {
        const makefileOutput = resp.output.replace(/\r/g, '').split(/\n/);
        await this.purgePublishedContent(makefileOutput);
        await this.logger.save(this.job._id, `${'(prod)'.padEnd(15)}Finished pushing to production`);
        await this.logger.save(this.job._id, `${'(prod)'.padEnd(15)}Deploy details:\n\n${resp.output}`);
      }
      return resp;
    } catch (errResult) {
      await this.logger.save(this.job._id, `${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
