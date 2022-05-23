import { JobHandler } from './jobHandler';
import { IConfig } from 'config';
import type { Job } from '../entities/job';
import { JobRepository } from '../repositories/jobRepository';
import { ICDNConnector } from '../services/cdn';
import { CommandExecutorResponse, IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { IJobValidator } from './jobValidator';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { InvalidJobError } from '../errors/errors';

// TODO: Move this to a generic util and out of this job file
const joinUrlAndPrefix = (url, prefix) => {
  const needsTrim = url.endsWith('/') && prefix.startsWith('/');
  const needsSlash = !url.endsWith('/') && !prefix.startsWith('/');

  return needsTrim ? url.slice(-1) + prefix : needsSlash ? url + '/' + prefix : url + prefix;
};

// Long term goal is to have mut script run off the AST so we can parallelize
// build&deploy jobs and manifestGeneration jobs
export class ManifestJobHandler extends JobHandler {
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
    this.name = 'Manifest';
  }

  // TODO: Make this a non-state-mutating function, e.g. return the deployCommands?
  // TODO: Separate logic for composing mut-index string into separate helper function?
  prepDeployCommands(): void {
    const b = this._config.get<string>('searchIndexBucket') ?? 'docs-search-indexes-test';
    // /deploy -> send to /prd folder. /test-deploy -> send to /preprd folder
    const env = this._config.get<string>('env');
    // Note: mut-index automatically prepends 'search-indexes/' to the folder.
    const f = this._config.get<string>('searchIndexFolder')[env] ?? 'fallback-folder';
    this.logger.info(this.currJob._id, `Manifest attempt to upload to bucket: ${b}, folder: ${f}`);
    // Due to the dual existence of prefixes, check for both for redundancy
    const maP = this.currJob.manifestPrefix ?? this.currJob.payload.manifestPrefix;
    const muP = this.currJob.mutPrefix ?? this.currJob.payload.mutPrefix;
    const url = this.currJob.payload?.repoBranches?.url[env];
    const jUaP = joinUrlAndPrefix;
    const globalSearch = this.currJob.payload.stable ? '-g' : '';

    // Rudimentary error logging
    if (!b) {
      this.logger.info(this.currJob._id, `searchIndexBucket not found`);
    }
    if (!f) {
      this.logger.info(this.currJob._id, `searchIndexFolder not found`);
    }

    if (!url) {
      this.logger.info(
        this.currJob._id,
        `repoBranches.url entry for this environment (${env}) not found for ${this.currJob._id}`
      );
      throw new InvalidJobError(
        `repoBranches.url entry for this environment (${env}) not found for ${this.currJob._id}`
      );
    }

    if (!this.currJob.manifestPrefix) {
      this.logger.info(this.currJob._id, `Manifest prefix not found for ${this.currJob._id}`);
      throw new InvalidJobError(`Manifest prefix not found for ${this.currJob._id}`);
    }

    // For mut-index usage info, see: https://github.com/mongodb/mut/blob/master/mut/index/main.py#L2
    this.currJob.deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.currJob.payload.repoName}`,
      'echo IGNORE: testing manifest generation deploy commands',
      'ls -al',
      `mut-index upload public -b ${b} -o ${f}/${maP}.json -u ${jUaP(url, muP)} ${globalSearch}`,
    ];
  }

  // TODO: Can this function be merged with prepBuildCommands?
  prepStageSpecificNextGenCommands(): void {
    if (this.currJob?.buildCommands) {
      this.currJob.buildCommands[this.currJob.buildCommands.length - 1] = 'make get-build-dependencies';
      this.currJob.buildCommands.push('make next-gen-html');
    }
  }

  async deploy(): Promise<CommandExecutorResponse> {
    try {
      const resp = await this.deployGeneric(); // runs prepDeployCommands
      await this.logger.save(this.currJob._id, `(generate manifest) Manifest generation details:\n\n${resp?.output}`);
      return resp;
    } catch (errResult) {
      await this.logger.save(this.currJob._id, `(generate manifest) stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
