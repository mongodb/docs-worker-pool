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
import { RepoEntitlementsRepository } from '../repositories/repoEntitlementsRepository';

export class StagingJobHandler extends JobHandler {
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
      repoEntitlementsRepo
    );
    this.name = 'Staging';
  }

  prepDeployCommands(): void {
    // TODO: Can we make this more readable?
    this.currJob.deployCommands = ['. /venv/bin/activate', `cd repos/${this.currJob.payload.repoName}`, 'make stage'];
    if (this.currJob.payload.isNextGen) {
      if (this.currJob.payload.pathPrefix) {
        this.currJob.deployCommands[
          this.currJob.deployCommands.length - 1
        ] = `make next-gen-stage MUT_PREFIX=${this.currJob.payload.mutPrefix}`;
      } else {
        this.currJob.deployCommands[this.currJob.deployCommands.length - 1] = 'make next-gen-stage';
      }
    }
  }

  prepStageSpecificNextGenCommands(): void {
    if (this.currJob.buildCommands) {
      this.currJob.buildCommands[this.currJob.buildCommands.length - 1] = 'make next-gen-parse';
      this.currJob.buildCommands.push(`make next-gen-html GH_USER=${this.currJob.payload.repoOwner}`);
      const project = this.currJob.payload.project === 'cloud-docs' ? this.currJob.payload.project : '';
      const branchName = /^[a-zA-Z0-9_\-\./]+$/.test(this.currJob.payload.branchName)
        ? this.currJob.payload.branchName
        : '';
      this.currJob.buildCommands.push(
        `make oas-page-build MUT_PREFIX=${this.currJob.payload.mutPrefix} PROJECT=${project} BRANCH_NAME=${branchName}`
      );
    }
  }
  async deploy(): Promise<CommandExecutorResponse> {
    try {
      const resp = await this.deployGeneric();
      const summary = '';
      if (resp?.output?.includes('Summary')) {
        resp.output = resp.output.slice(resp.output.indexOf('Summary'));
      }
      // Invoke Gatsby Preview Webhook
      const featurePreviewWebhookEnabled = process.env.GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED;
      // Logging for Debugging purposes only will remove once we see the build working in Gatsby.
      await this.logger.save(
        this.currJob._id,
        `${'(GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED)'.padEnd(15)}${featurePreviewWebhookEnabled}`
      );
      if (featurePreviewWebhookEnabled) {
        // TODO: current using a rudimentary logging approach, should switch to
        // something more robust once we are closer to going live.
        try {
          const response = await this.previewWebhook();
          await this.logger.save(this.currJob._id, `${'(POST Webhook Status)'.padEnd(15)}${response.status}`);
        } catch (err) {
          await this.logger.save(
            this.currJob._id,
            `${'(POST Webhook)'.padEnd(15)}Failed to POST to Gatsby Cloud webhook: ${err}`
          );
        }
      }

      await this.logger.save(this.currJob._id, `${'(stage)'.padEnd(15)}Finished pushing to staging`);
      await this.logger.save(this.currJob._id, `${'(stage)'.padEnd(15)}Staging push details:\n\n${summary}`);
      return resp;
    } catch (errResult) {
      await this.logger.save(this.currJob._id, `${'(stage)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }
}
