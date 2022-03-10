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
    // TODO: bucket and url are environment variables from pool.repo_branches.
    // When search is correctly configured, reference bucket and url from
    // https://github.com/mongodb/docs-worker-pool/blob/6516a2643ab586a358223f75d99df967531134fe/src/job/jobHandler.ts#L322
    const bucket = 'docs-search-indexes-test'; // may need to init bucket first?
    const url = 'https://docs-mongodborg-staging.corp.mongodb.com'; // dev url
    const manifestPrefix = this.currJob.payload.manifestPrefix;
    const mutPrefix = this.currJob.payload.mutPrefix;
    const globalSearchFlag = this.currJob.payload.stable ?? '';

    // Hacky manifest error catching - should not occur at this level
    if (!manifestPrefix || manifestPrefix.includes('null')) {
      this.currJob.deployCommands = [`echo ERROR: malformed manifest prefix ${manifestPrefix}.`];
      return;
    }

    this.currJob.deployCommands = [
      '. /venv/bin/activate',
      `cd repos/${this.currJob.payload.repoName}`,
      'echo IGNORE: generating test search manifest from new infrastructure',
      `mut-index upload public -b ${bucket} -o ${manifestPrefix}.json -u ${url}/${mutPrefix} -s ${globalSearchFlag} $(BUCKET_FLAG)`,
    ];
  }

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
