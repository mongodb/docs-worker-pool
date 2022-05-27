import { IConfig } from 'config';
import { CDNCreds } from '../entities/creds';
import type { Job } from '../entities/job';
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
    job: Job,
    config: IConfig,
    jobRepository: JobRepository,
    fileSystemServices: IFileSystemServices,
    commandExecutor: IJobCommandExecutor,
    cdnConnector: ICDNConnector,
    repoConnector: IRepoConnector,
    logger: IJobRepoLogger,
    validator: IJobValidator,
    repoBranchesRepo: RepoBranchesRepository
  ) {
    super(
      job,
      config,
      jobRepository,
      fileSystemServices,
      commandExecutor,
      cdnConnector,
      repoConnector,
      logger,
      validator,
      repoBranchesRepo
    );
    this.name = 'Production';
  }
  prepDeployCommands(): void {
    // TODO: Can we simplify the chain of logic here?
    this.currJob.deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.currJob.payload.repoName}`,
      'make publish && make deploy',
    ];

    // TODO: Reduce confusion between job.manifestPrefix and job.payload.manifestPrefix
    if (this.currJob.payload.isNextGen) {
      const manifestPrefix = this.currJob.payload.manifestPrefix;
      this.currJob.deployCommands[
        this.currJob.deployCommands.length - 1
      ] = `make next-gen-deploy MUT_PREFIX=${this.currJob.payload.mutPrefix}`;
      // TODO: Remove when satisfied with new manifestJobHandler infrastructure
      if (manifestPrefix) {
        const searchFlag = this.currJob.payload.stable;
        this.currJob.deployCommands[
          this.currJob.deployCommands.length - 1
        ] += ` MANIFEST_PREFIX=${manifestPrefix} GLOBAL_SEARCH_FLAG=${searchFlag}`;
      }
    }
  }

  prepStageSpecificNextGenCommands(): void {
    if (this.currJob?.buildCommands) {
      this.currJob.buildCommands[this.currJob.buildCommands.length - 1] = 'make get-build-dependencies';
      this.currJob.buildCommands.push('make next-gen-html');
    }
  }

  getActiveBranchLength(): number {
    return this.currJob.payload.repoBranches.branches.filter((b) => b['active']).length;
  }

  getPathPrefix(): string {
    try {
      if (this.currJob.payload.prefix && this.currJob.payload.prefix === '') {
        return this.currJob.payload.urlSlug ?? '';
      }
      if (this.currJob.payload.urlSlug) {
        if (this.currJob.payload.urlSlug === '') {
          return this.currJob.payload.prefix;
        } else {
          return `${this.currJob.payload.prefix}/${this.currJob.payload.urlSlug}`;
        }
      }
      return this.currJob.payload.prefix;
    } catch (error) {
      this.logger.save(this.currJob._id, error).then();
      throw new InvalidJobError(error.message);
    }
  }

  private async purgePublishedContent(makefileOutput: Array<string>): Promise<void> {
    try {
      const stdoutJSON = JSON.parse(makefileOutput[2]);
      //contains URLs corresponding to files updated via our push to S3
      const updatedURLsArray = stdoutJSON.urls;
      // purgeCache purges the now stale content and requests the URLs to warm the cache for our users
      await this.logger.save(this.currJob._id, JSON.stringify(updatedURLsArray));
      console.log('this.currJob.payload.prefix : ' + this.currJob.payload.prefix);
      const id = await this._cdnConnector.purge(this.currJob._id, updatedURLsArray, this.currJob.payload.prefix);
      await this.jobRepository.insertPurgedUrls(this.currJob._id, updatedURLsArray);
      if (id) {
        await this.jobRepository.insertInvalidationRequestStatusUrl(
          this.currJob._id,
          `${this._config.get<string>('cdnInvalidatorServiceURL')}/${id}`
        );
      } else {
        await this.jobRepository.insertInvalidationRequestStatusUrl(this.currJob._id, 'Invalidation Failed');
      }
    } catch (error) {
      await this.logger.save(this.currJob._id, error);
    }
  }

  private getCdnCreds(): CDNCreds {
    let creds = this._config.get<any>('cdn_creds')['main'];
    if (this.currJob?.payload?.repoName in this._config.get<any>('cdn_creds')) {
      creds = this._config.get<any>('cdn_creds')[this.currJob.payload.repoName];
    }
    return new CDNCreds(creds['id'], creds['token']);
  }

  async deploy(): Promise<CommandExecutorResponse> {
    const resp = await this.deployGeneric();
    try {
      if (resp?.output) {
        const makefileOutput = resp.output.replace(/\r/g, '').split(/\n/);
        await this.purgePublishedContent(makefileOutput);
        await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}Finished pushing to production`);
        await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}Deploy details:\n\n${resp.output}`);
      }

      this.currJob.shouldGenerateSearchManifest = this.shouldGenerateSearchManifest();
      if (this.currJob.shouldGenerateSearchManifest) {
        this.queueManifestJob();
      }
      return resp;
    } catch (errResult) {
      await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
