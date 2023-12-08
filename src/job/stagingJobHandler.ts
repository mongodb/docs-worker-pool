import path from 'path';
import fs from 'fs';
import { getDirectory, JobHandler } from './jobHandler';
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
import { DocsetsRepository } from '../repositories/docsetsRepository';
import { nextGenStage } from '../commands';
import { MONOREPO_NAME } from '../monorepo/utils/monorepo-constants';

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
    this.name = 'Staging';
  }

  prepDeployCommands(): void {
    // TODO: Can we make this more readable?
    this.currJob.deployCommands = ['. /venv/bin/activate', `cd repos/${getDirectory(this.currJob)}`, 'make stage'];
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
      this.currJob.buildCommands.push(
        `make persistence-module GH_USER=${this.currJob.payload.repoOwner} JOB_ID=${this.currJob._id}`
      );
      this.currJob.buildCommands.push('make next-gen-html');
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
    let resp;
    try {
      // TODO: MONOREPO feature flag needed
      if (
        // process.env.FEATURE_FLAG_MONOREPO_PATH === 'true' &&
        this.currJob.payload.repoName === MONOREPO_NAME
      ) {
        const logger = (message: string) => this.logger.save(this.currJob._id, message);
        const repo_info = await this._docsetsRepo.getRepo(
          this.currJob.payload.repoName,
          this.currJob.payload.directory
        );
        if (!repo_info) {
          const errorMessage = `
            Docset Repo data not found in Atlas for repoName: ${this.currJob.payload.repoName}\n
            ${this.currJob.payload.directory ? `directory: ${this.currJob.payload.directory}\n` : ''}
            project: ${this.currJob.payload.project}
          `;
          logger(`ERROR: ${errorMessage}`);
          throw Error(errorMessage);
        }
        const environment = process.env.SNOOTY_ENV;
        logger(`ENVIRONMENT???? process.env.SNOOTY_ENV: "${environment}"`);
        const bucket = repo_info.bucket.stg;
        const url = repo_info.url.stg;

        resp = await nextGenStage({ job: this.currJob, logger, bucket, url });
      } else {
        resp = await this.deployGeneric();
      }
      const summary = '';
      if (resp.output?.includes('Summary')) {
        resp.output = resp.output.slice(resp.output.indexOf('Summary'));
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
