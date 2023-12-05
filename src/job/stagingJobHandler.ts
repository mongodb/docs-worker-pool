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
import {
  nextGenHtml,
  nextGenParse,
  nextGenStage,
  oasPageBuild,
  persistenceModule,
  prepareBuildAndGetDependencies,
} from '../commands';

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

  async build(): Promise<boolean> {
    const preppedLogger = (msg: string) => this.logger.save(this.currJob._id, msg);

    await this.setEnvironmentVariables();
    this.logger.save(this.currJob._id, 'Prepared Environment variables');

    await prepareBuildAndGetDependencies(
      this.currJob.payload.repoOwner,
      this.currJob.payload.repoName,
      this.currJob.payload.project,
      'https://mongodbcom-cdn.website.staging.corp.mongodb.com',
      this.currJob.payload.branchName,
      (message: string) => this.logger.save(this.currJob._id, message),
      this.currJob.payload.newHead
    );
    // await this.pullRepo();
    // this._logger.save(this._currJob._id, 'Pulled Repo');
    // try {
    //   await this.repoConnector.pullRepo(this.currJob);
    // } catch (error) {
    //   await error;
    //   throw error;
    // }

    await nextGenParse({ job: this.currJob, preppedLogger });
    this.logger.save(this.currJob._id, 'Repo Parsing Completed');
    await persistenceModule({ job: this.currJob, preppedLogger });
    this.logger.save(this.currJob._id, 'Persistence Module Complete');
    // Call Gatsby Cloud preview webhook after persistence module finishes for staging builds
    const isFeaturePreviewWebhookEnabled = process.env.GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED?.toLowerCase() === 'true';
    if (this.name === 'Staging' && isFeaturePreviewWebhookEnabled) {
      await this.callGatsbyCloudWebhook();
    }
    this.logger.save(this.currJob._id, 'Gatsby Webhook Called');
    await oasPageBuild({ job: this.currJob, preppedLogger });
    this.logger.save(this.currJob._id, 'OAS Page Build Complete');
    await nextGenHtml({ job: this.currJob, preppedLogger });
    this.logger.save(this.currJob._id, 'NextGenHtml Finished');

    return true;
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
    try {
      // if (this.currJob.payload.repoName === MONOREPO_NAME) {
      // this.logger.save(this.currJob._id, `ITS MONOREPO, let's stage!! All the world's a stage.`);
      // resp = await nextGenStage({
      //   job: this.currJob,
      //   preppedLogger: (message: string) => this.logger.save(this.currJob._id, message),
      // });
      // resp = await this.deployGeneric();
      // } else {
      // TODO: this should be normal deployGeneric
      // this.logger.save(this.currJob._id, `ITS fake monorepo, let's stage!! All the world's a stage.`);
      // const hasConfigRedirects = fs.existsSync(path.join(process.cwd(), 'config/redirects'));
      // this.logger.save(this.currJob._id, `hasConfigRedirects: ${hasConfigRedirects}`);
      // resp = await nextGenStage({
      //   job: this.currJob,
      //   preppedLogger: (message: string) => this.logger.save(this.currJob._id, message),
      // });
      // this.logger.save(this.currJob._id, `Now to deploy `);
      // await nextGenDeploy({
      //   gitBranch: this.currJob.payload.branchName,
      //   mutPrefix: this.currJob.mutPrefix || '',
      //   hasConfigRedirects: hasConfigRedirects,
      //   preppedLogger: (message: string) => this.logger.save(this.currJob._id, message),
      // });
      // resp = await this.deployGeneric();
      // }
      this.currJob;
      const preppedLogger = (message: string) => this.logger.save(this.currJob._id, message);
      const repo_info = await this._docsetsRepo.getRepo(this.currJob.payload.repoName, this.currJob.payload.directory);
      if (!repo_info) {
        preppedLogger(`repo info not found`);
      }
      console.log('repo info ', repo_info);
      const environment = process.env.SNOOTY_ENV;
      console.log('environment ', environment);
      const bucket = repo_info.bucket.stg;
      const url = repo_info.url.stg;
      console.log('BUCKET: ', bucket);
      console.log('URL: ', url);

      const resp = await nextGenStage({ job: this.currJob, preppedLogger, bucket, url });
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
