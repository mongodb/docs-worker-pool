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
  prepDeployCommands(): void {
    // /deploy -> send to /prd folder. /test-deploy -> send to /preprd folder
    const b = 'docs-search-indexes-test/test';
    const maP = this.currJob.manifestPrefix;
    const url = this.currJob.payload.url;
    const muP = this.currJob.mutPrefix;
    const globalSearch = this.currJob.payload.stable ? '-g' : '';

    if (!this.currJob.manifestPrefix) {
      this.logger.info(this.currJob._id, `Manifest prefix not found for ${this.currJob._id}`);
      throw new InvalidJobError(`Manifest prefix not found for ${this.currJob._id}`);
    }

    // For mut-index usage info, see: https://github.com/mongodb/mut/blob/master/mut/index/main.py#L2
    this.currJob.deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.currJob.payload.repoName}`,
      'echo IGNORE: testing manifest generation deploy commands',
      `mut-index upload public -b ${b} -o ${maP}.json -u ${url}/${muP} ${globalSearch}`,
    ];
  }

  // TODO: Is this function from jobHandler strictly necessary?
  prepStageSpecificNextGenCommands(): void {
    return;
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
