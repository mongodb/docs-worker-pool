import { IConfig } from 'config';
import type { Job } from '../entities/job';
import { InvalidJobError } from '../errors/errors';
import { DocsetsRepository } from '../repositories/docsetsRepository';
import { JobRepository } from '../repositories/jobRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { RepoEntitlementsRepository } from '../repositories/repoEntitlementsRepository';
import { ICDNConnector } from '../services/cdn';
import { CommandExecutorResponse, IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { getDirectory, JobHandler } from './jobHandler';
import { IJobValidator } from './jobValidator';
import { joinUrlAndPrefix } from './manifestJobHandler';
import { MONOREPO_NAME } from '../monorepo/utils/monorepo-constants';
import { nextGenDeploy } from '../commands';
import { checkRedirects } from '../commands/src/helpers/dependency-helpers';

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
    repoBranchesRepo: RepoBranchesRepository,
    docsetsRepo: DocsetsRepository,
    repoEntitlementsRepo: RepoEntitlementsRepository
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
      repoBranchesRepo,
      docsetsRepo,
      repoEntitlementsRepo
    );
    this.name = 'Production';
  }
  prepDeployCommands(): void {
    // TODO: Can we simplify the chain of logic here?
    this.currJob.deployCommands = [
      `cd repos/${getDirectory(this.currJob)}`,
      'make next-gen-publish && make next-gen-deploy',
    ];

    // TODO: Reduce confusion between job.manifestPrefix and job.payload.manifestPrefix
    this.currJob.manifestPrefix = this.currJob.manifestPrefix ?? this.constructManifestPrefix();
    this.currJob.deployCommands[
      this.currJob.deployCommands.length - 1
    ] = `make next-gen-deploy MUT_PREFIX=${this.currJob.payload.mutPrefix}`;
    // TODO: Remove when satisfied with new manifestJobHandler infrastructure
    if (this.currJob.manifestPrefix) {
      const searchFlag = this.currJob.payload.stable ? '-g' : '';
      this.currJob.deployCommands[
        this.currJob.deployCommands.length - 1
      ] += ` MANIFEST_PREFIX=${this.currJob.manifestPrefix} GLOBAL_SEARCH_FLAG=${searchFlag}`;
    }

    // have to combine search deploy commands
    // manifestJobHandler.prepDeployCommands

    this.currJob.shouldGenerateSearchManifest = this.shouldGenerateSearchManifest();
    this.logger.save(
      this.currJob._id,
      `this.currJob.shouldGenerateSearchManifest ${this.currJob.shouldGenerateSearchManifest}`
    );
    if (this.currJob.shouldGenerateSearchManifest) {
      this.prepSearchDeploy();
    }
  }

  prepSearchDeploy(): void {
    const b = this._config.get<string>('searchIndexBucket') ?? 'docs-search-indexes-test';
    // /deploy -> send to /prd folder. /test-deploy -> send to /preprd folder
    const env = this._config.get<string>('env');
    // Note: mut-index automatically prepends 'search-indexes/' to the folder.
    const f = this._config.get<string>('searchIndexFolder')?.[env] ?? 'fallback-folder';
    this.logger.save(this.currJob._id, `Manifest attempt to upload to bucket: ${b}, folder: ${f}`);
    // Due to the dual existence of prefixes, check for both for redundancy
    const maP = this.currJob.manifestPrefix ?? this.currJob.payload.manifestPrefix;
    const muP = this.currJob.mutPrefix ?? this.currJob.payload.mutPrefix;
    const url = this.currJob.payload?.repoBranches?.url?.[env];
    const jUaP = joinUrlAndPrefix;
    const globalSearch = this.currJob.payload.stable ? '-g' : '';

    // Rudimentary error logging
    if (!b) {
      this.logger.save(this.currJob._id, `searchIndexBucket not found`);
    }
    if (!f) {
      this.logger.save(this.currJob._id, `searchIndexFolder not found`);
    }

    if (!url) {
      this.logger.error(
        this.currJob._id,
        `repoBranches.url entry for this environment (${env}) not found for ${this.currJob._id}`
      );
      return;
    }

    if (!this.currJob.manifestPrefix) {
      this.logger.error(this.currJob._id, `Manifest prefix not found for ${this.currJob._id}`);
      return;
    }
    const searchCommands = [
      `cd repos/${getDirectory(this.currJob)}`,
      'echo IGNORE: testing manifest generation deploy commands',
      'ls -al',
      // For mut-index usage info, see: https://github.com/mongodb/mut/blob/master/mut/index/main.py#L2
      `mut-index upload bundle.zip -b ${b} -o ${f}/${maP}.json -u ${jUaP(url, muP || '')} ${globalSearch}`,
    ];
    for (const command of searchCommands) {
      if (this.currJob.deployCommands.indexOf(command) === -1) {
        this.currJob.deployCommands.push(command);
      }
    }
    this.logger.save(
      this.currJob._id,
      `deploy commands: ${this.currJob.deployCommands.map((command) => command + '\n')}`
    );
  }

  prepStageSpecificNextGenCommands(): void {
    if (this.currJob?.buildCommands) {
      this.currJob.buildCommands[this.currJob.buildCommands.length - 1] = 'make get-build-dependencies';
      this.currJob.buildCommands.push('make next-gen-parse NO_CACHING=--no-caching');
      this.currJob.buildCommands.push(`make persistence-module JOB_ID=${this.currJob._id}`);
      this.currJob.buildCommands.push('make next-gen-html');
      this.currJob.buildCommands.push(`make oas-page-build MUT_PREFIX=${this.currJob.payload.mutPrefix}`);
    }
  }

  getPathPrefix(): string {
    if (this.currJob.payload.urlSlug) {
      return `${this.currJob.payload.prefix}/${this.currJob.payload.urlSlug}`;
    }
    return this.currJob.payload.prefix;
  }

  private async purgePublishedContent(makefileOutput: Array<string>): Promise<void> {
    try {
      const stdoutJSON = JSON.parse(makefileOutput[2]);
      //contains URLs corresponding to files updated via our push to S3
      const updatedURLsArray = stdoutJSON.urls;
      // purgeCache purges the now stale content and requests the URLs to warm the cache for our users
      await this.logger.save(this.currJob._id, JSON.stringify(updatedURLsArray));
      await this.logger.save(
        this.currJob._id,
        `current job prefix to be used for wildcard url invalidation: ${this.currJob.payload.prefix}`
      );
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

  async deploy(): Promise<CommandExecutorResponse> {
    let resp;
    if (process.env.FEATURE_FLAG_MONOREPO_PATH === 'true' && this.currJob.payload.repoName === MONOREPO_NAME) {
      const { mutPrefix, branchName } = this.currJob.payload;
      await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)} Begin Deploy without makefiles`);

      const { bucket, url } = await this.getEnvironmentVariables();
      const hasConfigRedirects = await checkRedirects(this.currJob.payload.repoName, this.currJob.payload.directory);

      resp = await nextGenDeploy({ mutPrefix, bucket, url, branchName, hasConfigRedirects });
    } else {
      resp = await this.deployWithMakefiles();
    }
    try {
      if (resp?.output) {
        const makefileOutput = resp.output.replace(/\r/g, '').split(/\n/);
        await this.purgePublishedContent(makefileOutput);
        await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}Finished pushing to production`);
        await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}Deploy details:\n\n${resp.output}`);
      }

      return resp;
    } catch (errResult) {
      await this.logger.save(this.currJob._id, `${'(prod)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
