import { JobHandler } from './jobHandler';
import { IConfig } from 'config';
import { BuildJob } from '../entities/job';
import { JobRepository } from '../repositories/jobRepository';
import { ICDNConnector } from '../services/cdn';
import { CommandExecutorResponse, IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { IJobValidator } from './jobValidator';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';

export class StagingJobHandler extends JobHandler {
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
    this.name = 'Staging';
  }

  prepDeployCommands(): void {
    // TODO: Can we simplify the chain of logic here?
    this.job.deployCommands = ['. /venv/bin/activate', `cd repos/${this.job.payload.repoName}`, 'make stage'];
    if (this.job.payload.isNextGen) {
      if (this.job.payload.pathPrefix) {
        this.job.deployCommands[
          this.job.deployCommands.length - 1
        ] = `make next-gen-stage MUT_PREFIX=${this.job.payload.mutPrefix}`;
      } else {
        this.job.deployCommands[this.job.deployCommands.length - 1] = 'make next-gen-stage';
      }
    }
  }

  prepStageSpecificNextGenCommands(): void {
    if (this.job.buildCommands) {
      this.job.buildCommands[this.job.buildCommands.length - 1] = 'make next-gen-html';
      if (this.job.payload.repoName === 'devhub-content-integration') {
        this.job.buildCommands[this.job.buildCommands.length - 1] += ` STRAPI_PUBLICATION_STATE=preview`;
      }
    }
  }
  async deploy(): Promise<CommandExecutorResponse> {
    try {
      const resp = await this.deployGeneric();
      const summary = '';
      if (resp?.output?.includes('Summary')) {
        resp.output = resp.output.slice(resp.output.indexOf('Summary'));
      }
      await this.logger.save(this.job._id, `${'(stage)'.padEnd(15)}Finished pushing to staging`);
      await this.logger.save(this.job._id, `${'(stage)'.padEnd(15)}Staging push details:\n\n${summary}`);
      return resp;
    } catch (errResult) {
      await this.logger.save(this.job._id, `${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
