import { JobHandler } from './jobHandler';
import { IConfig } from 'config';
import { ManifestJob } from '../entities/job';
import { JobRepository } from '../repositories/jobRepository';
import { ICDNConnector } from '../services/cdn';
import { CommandExecutorResponse, IJobCommandExecutor } from '../services/commandExecutor';
import { IFileSystemServices } from '../services/fileServices';
import { IJobRepoLogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { IJobValidator } from './jobValidator';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';

export class ManifestJobHandler extends JobHandler {
  constructor(
    job: ManifestJob,
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
    this.name = 'Manifest';
  }

  // TODO: Make this a non-state-mutating function, e.g. return the deployCommands?
  prepDeployCommands(): void {
    this.job.deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.job.payload.repoName}`,
      'echo test-manifest-generation-deploy-commands',
    ];
  }

  prepStageSpecificNextGenCommands(): void {
    return;
  }

  async deploy(): Promise<CommandExecutorResponse> {
    try {
      const resp = await this.deployGeneric();
      await this.logger.save(this.job._id, `(generate manifest) Manifest generation details:\n\n${resp?.output}`);
      return resp;
    } catch (errResult) {
      await this.logger.save(this.job._id, `(generate manifest) stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
