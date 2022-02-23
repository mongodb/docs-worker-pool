import { BuildJob, ManifestJob } from '../entities/job';
import { JobRepository } from '../repositories/jobRepository';
import { RepoBranchesRepository } from '../repositories/repoBranchesRepository';
import { ICDNConnector } from '../services/cdn';
import { CommandExecutorResponse, IJobCommandExecutor } from '../services/commandExecutor';
import { IJobRepoLogger, ILogger } from '../services/logger';
import { IRepoConnector } from '../services/repo';
import { IFileSystemServices } from '../services/fileServices';
import { AutoBuilderError, InvalidJobError, JobStoppedError, PublishError } from '../errors/errors';
import { IConfig } from 'config';
import { IJobValidator } from './jobValidator';
require('fs');

// TODO: Do we need private variables & public getters? Why not just public vars?
export abstract class JobHandler {
  private _job: BuildJob | ManifestJob;
  public get job(): BuildJob | ManifestJob {
    return this._job;
  }
  private get jobType(): string {
    return this._job.payload.jobType;
  }

  private _commandExecutor: IJobCommandExecutor;
  protected get commandExecutor(): IJobCommandExecutor {
    return this._commandExecutor;
  }
  protected _cdnConnector: ICDNConnector;

  private _repoConnector: IRepoConnector;

  private _logger: IJobRepoLogger;
  protected get logger(): IJobRepoLogger {
    return this._logger;
  }

  private _jobRepository: JobRepository;
  public get jobRepository(): JobRepository {
    return this._jobRepository;
  }
  private _fileSystemServices: IFileSystemServices;

  private _shouldStop: boolean;

  private _stopped: boolean;
  public get stopped(): boolean {
    return this._stopped;
  }
  public set stopped(value: boolean) {
    this._stopped = value;
  }

  private _validator: IJobValidator;

  protected _config: IConfig;

  protected name: string;

  protected _repoBranchesRepo: RepoBranchesRepository;

  constructor(
    job: BuildJob | ManifestJob,
    cdnConnector: ICDNConnector,
    commandExecutor: IJobCommandExecutor,
    config: IConfig,
    fileSystemServices: IFileSystemServices,
    jobRepository: JobRepository,
    logger: IJobRepoLogger,
    repoBranchesRepo: RepoBranchesRepository,
    repoConnector: IRepoConnector,
    validator: IJobValidator
  ) {
    this._job = job;
    this._cdnConnector = cdnConnector;
    this._commandExecutor = commandExecutor;
    this._config = config;
    this._fileSystemServices = fileSystemServices;
    this._jobRepository = jobRepository;
    this._logger = logger;
    this._repoBranchesRepo = repoBranchesRepo;
    this._repoConnector = repoConnector;
    this._validator = validator;

    this._shouldStop = false;
  }

  abstract prepStageSpecificNextGenCommands(): void;

  private logErrorMessage(message: string): void {
    this.logger.error(this.job._id, message);
  }
  private async update(publishResult: CommandExecutorResponse): Promise<void> {
    if (publishResult) {
      if (publishResult?.status === 'success') {
        const files = this._fileSystemServices.getFilesInDirectory(
          `./${this.job.payload.repoName}/build/public`,
          '',
          null,
          null
        );
        await this.jobRepository.updateWithCompletionStatus(this.job._id, files);
      } else {
        if (publishResult.error) {
          await this.jobRepository.updateWithErrorStatus(this.job._id, publishResult.error);
        } else {
          this.logErrorMessage('PublishResult error is undefined');
        }
      }
      if (publishResult.output) {
        await this.jobRepository.insertNotificationMessages(this.job._id, publishResult.output);
      } else {
        this.logErrorMessage('PublishResult output is undefined');
      }
    } else {
      this.logErrorMessage('PublishResult is undefined');
    }
  }

  private cleanup(): void {
    this._fileSystemServices.removeDirectory(`repos/${this.job.payload.repoName}`);
  }

  @throwIfJobInterupted()
  private async constructPrefix(): Promise<void> {
    const server_user = this._config.get<string>('GATSBY_PARSER_USER');
    const pathPrefix = await this.getPathPrefix();
    // TODO: Can empty string check be removed?
    if (pathPrefix || pathPrefix === '') {
      this.job.payload.pathPrefix = pathPrefix;
      const mutPrefix = pathPrefix.split(`/${server_user}`)[0];
      this.job.payload.mutPrefix = mutPrefix;
    }
  }

  @throwIfJobInterupted()
  private async logError(error): Promise<void> {
    await this.logger.save(this.job._id, `${'(BUILD)'.padEnd(15)}failed with code: ${error.code}. `);
    await this.logger.save(this.job._id, `${'(BUILD)'.padEnd(15)}stdErr: ${error.stderr}`);
  }

  @throwIfJobInterupted()
  private async cloneRepo(targetPath: string): Promise<void> {
    await this.logger.save(this.job._id, `${'(GIT)'.padEnd(15)}Cloning repository`);
    await this.logger.save(this.job._id, `${'(GIT)'.padEnd(15)}running fetch`);
    await this._repoConnector.cloneRepo(this.job, targetPath);
  }

  @throwIfJobInterupted()
  private async commitCheck(): Promise<void> {
    // if commit hash is provided, use that
    if (this.job?.payload?.newHead && this.job?.title !== 'Regression Test Child Process') {
      try {
        const resp = await this._repoConnector.checkCommits(this.job);
        // The response output MUST contain the branchName, or else we did not find the commit
        if (!resp?.output?.includes(`* ${this.job.payload.branchName}`)) {
          const err = new InvalidJobError(`Specified commit does not exist on ${this.job.payload.branchName} branch`);
          await this.logger.save(
            this.job._id,
            `${'(BUILD)'.padEnd(15)} failed. The specified commit does not exist on ${
              this.job.payload.branchName
            } branch.`
          );
          throw err;
        }
      } catch (error) {
        if (!(error instanceof AutoBuilderError)) {
          await this.logError(error);
        }
        throw error;
      }
    }
  }

  @throwIfJobInterupted()
  private async pullRepo(): Promise<void> {
    try {
      await this._repoConnector.pullRepo(this.job);
    } catch (error) {
      await error;
      throw error;
    }
  }

  @throwIfJobInterupted()
  private async downloadMakeFile(): Promise<void> {
    try {
      this.logger.info(
        this.job._id,
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${this.job.payload.repoName}`
      );
      await this._fileSystemServices.saveUrlAsFile(
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${this.job.payload.repoName}`,
        `repos/${this.job.payload.repoName}/Makefile`,
        {
          encoding: 'utf8',
          flag: 'w',
        }
      );
    } catch (error) {
      await this.logError(error);
      throw error;
    }
  }

  @throwIfJobInterupted()
  public isbuildNextGen(): boolean {
    const workerPath = `repos/${this.job.payload.repoName}/worker.sh`;
    if (this._fileSystemServices.rootFileExists(workerPath)) {
      const workerContents = this._fileSystemServices.readFileAsUtf8(workerPath);
      const workerLines = workerContents.split(/\r?\n/);
      return workerLines.includes('"build-and-stage-next-gen"');
    }
    return false;
  }

  @throwIfJobInterupted()
  private async prepNextGenBuild(): Promise<void> {
    if (this.isbuildNextGen()) {
      await this._validator.throwIfBranchNotConfigured(this.job);
      await this.constructPrefix();
      // if this payload is NOT aliased or if it's the primary alias, we need the index path
      if (!this.job.payload.aliased || (this.job.payload.aliased && this.job.payload.primaryAlias)) {
        await this.constructManifestIndexPath();
      }

      this.prepStageSpecificNextGenCommands();
      this.constructEnvVars();
      this.job.payload.isNextGen = true;
      if (this.jobType === 'productionDeploy') {
        this._validator.throwIfNotPublishable(this.job);
      }
    } else {
      this.job.payload.isNextGen = false;
    }
  }

  @throwIfJobInterupted()
  private async executeBuild(): Promise<boolean> {
    if (this.job.buildCommands && this.job.buildCommands.length > 0) {
      await this.logger.save(this.job._id, `${'(BUILD)'.padEnd(15)}Running Build`);
      await this.logger.save(this.job._id, `${'(BUILD)'.padEnd(15)}running worker.sh`);
      const resp = await this._commandExecutor.execute(this.job.buildCommands);
      await this.logger.save(this.job._id, `${'(BUILD)'.padEnd(15)}Finished Build`);
      await this.logger.save(
        this.job._id,
        `${'(BUILD)'.padEnd(15)}worker.sh run details:\n\n${resp.output}\n---\n${resp.error}`
      );
      if (resp.status != 'success') {
        const error = new AutoBuilderError(resp.error, 'BuildError');
        await this.logError(error);
        throw error;
      }
    } else {
      const error = new AutoBuilderError('No commands to execute', 'BuildError');
      await this.logError(error);
      throw error;
    }
    return true;
  }

  private constructEnvVars(): void {
    // TODO: Would it make sense store envVars as an object in the future?
    let envVars = `GATSBY_PARSER_USER=${this._config.get<string>('GATSBY_PARSER_USER')}\nGATSBY_PARSER_BRANCH=${
      this.job.payload.branchName
    }\n`;
    const pathPrefix = this.job.payload.pathPrefix;
    // TODO: Do we need the empty string check?
    if (pathPrefix || pathPrefix === '') {
      envVars += `PATH_PREFIX=${pathPrefix}\n`;
    }
    // const snootyFrontEndVars = {
    //   'GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION': this._config.get<boolean>("gatsbyConsitentNavFlag"),
    //   'GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN': this._config.get<boolean>("gatsbySDKVersionDropdownFlag"),

    // };

    // for (const[envName, envValue] of Object.entries(snootyFrontEndVars)) {
    //   if (envValue) envVars += `${envName}=TRUE\n`;
    // }
    this._fileSystemServices.writeToFile(`repos/${this.job.payload.repoName}/.env.production`, envVars, {
      encoding: 'utf8',
      flag: 'w',
    });
  }

  protected getPathPrefix(): string {
    return '';
  }

  protected constructManifestIndexPath(): Promise<void> {
    return Promise.resolve();
  }

  protected abstract deploy(): Promise<CommandExecutorResponse>;

  // TODO: Make this a non-mutating state function, e.g. return the deployCommands
  protected abstract prepDeployCommands(): void;

  // TODO: Make this a non-mutating state function, e.g. return the buildCommands
  protected prepBuildCommands(): void {
    this.job.buildCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.job.payload.repoName}`,
      `rm -f makefile`,
      `make html`, // TODO: Can we remove this line, given how many jobHandler functions overwrite it?
    ];
  }

  protected async setEnvironmentVariables(): Promise<void> {
    const repo_info = await this._repoBranchesRepo.getRepoBranchesByRepoName(this.job.payload.repoName);
    let env = this._config.get<string>('env');
    this.logger.info(
      this.job._id,
      `setEnvironmentVariables for ${this.job.payload.repoName} env ${env} jobType ${this.jobType}`
    );
    if (repo_info?.['bucket'] && repo_info?.['url']) {
      if (this.job.payload.regression) {
        env = 'regression';
        process.env.REGRESSION = 'true';
      }
      process.env.BUCKET = repo_info['bucket'][env];
      process.env.URL = repo_info['url'][env];

      // Writers are tying to stage it, so lets update the staging bucket.
      if (env == 'prd' && this.jobType == 'githubPush') {
        process.env.BUCKET = repo_info['bucket'][env] + '-staging';
        process.env.URL = repo_info['url']['stg'];
      }
    }

    if (process.env.BUCKET) {
      this.logger.info(this.job._id, process.env.BUCKET);
    }
    if (process.env.URL) {
      this.logger.info(this.job._id, process.env.URL);
    }
  }

  @throwIfJobInterupted()
  protected async build(): Promise<boolean> {
    this.cleanup();
    await this.cloneRepo(this._config.get<string>('repo_dir'));
    this.logger.info(this.job._id, 'Cloned Repo');
    await this.commitCheck();
    this.logger.info(this.job._id, 'Checked Commit');
    await this.pullRepo();
    this.logger.info(this.job._id, 'Pulled Repo');
    this.prepBuildCommands();
    this.logger.info(this.job._id, 'Prepared Build commands');
    await this.prepNextGenBuild();
    this.logger.info(this.job._id, 'Prepared Next Gen build');
    await this._repoConnector.applyPatch(this.job);
    this.logger.info(this.job._id, 'Patch Applied');
    await this.downloadMakeFile();
    this.logger.info(this.job._id, 'Downloaded Makefile');
    await this.setEnvironmentVariables();
    this.logger.info(this.job._id, 'prepared Environment variables');
    return await this.executeBuild();
  }

  // TODO: Reduce complexity by not having individual child-class deploy() functions
  // that just refer back to deployGeneric(), which itself leans is basically just a
  // a wrapper for the command executor. E.g., the parent could call deployGeneric()
  // itself, and then call the child's job-specific deploy()
  @throwIfJobInterupted()
  protected async deployGeneric(): Promise<CommandExecutorResponse> {
    this.prepDeployCommands();
    await this.logger.save(this.job._id, `${this._config.get<string>('stage').padEnd(15)}Pushing to ${this.name}`);

    if ((this.job?.deployCommands?.length ?? 0) > 0) {
      const resp = await this._commandExecutor.execute(this.job.deployCommands);
      if (resp?.error?.includes('ERROR')) {
        await this.logger.save(
          this.job._id,
          `${this._config.get<string>('stage').padEnd(15)}Failed to push to ${this.name}`
        );
        throw new PublishError(`Failed pushing to ${this.name}: ${resp.error}`);
      }
      await this.logger.save(
        this.job._id,
        `${this._config.get<string>('stage').padEnd(15)}Finished pushing to ${this.name}`
      );
      await this.logger.save(
        this.job._id,
        `${this._config.get<string>('stage').padEnd(15)}push details:\n\n${resp.output}`
      );
      return resp;
    } else {
      await this.logger.save(
        this.job._id,
        `${this._config.get<string>('stage').padEnd(15)}Pushing to ${
          this.name
        } failed as there is no commands to execute`
      );
      throw new PublishError(`Failed pushing to ${this.name}, No commands to execute`);
    }
  }

  @throwIfJobInterupted()
  public async execute(): Promise<void> {
    await this.logger.save(this.job._id, `* Starting Job with ID: ${this.job._id} and type: ${this.jobType}`);
    try {
      await this.build();
      const resp = await this.deploy();
      await this.update(resp);
      // TODO: formalize jobTypes
      if (this.jobType in ['productionDeploy', 'githubPush']) {
        this.queueManifestJob();
      }
      this.cleanup();
    } catch (error) {
      try {
        await this._jobRepository.updateWithErrorStatus(this.job._id, error.message);
        this.cleanup();
      } catch (error) {
        this.logger.error(this.job._id, error.message);
      }
    }
  }

  private async queueManifestJob(): Promise<void> {
    // TODO: create new start time, id, etc.
    const manifestJob = this.job; // contains payload - need to swap to ManifestJob type
    manifestJob.createdTime = new Date();
    // normal buildJobs have a priority of 1. Give a "lower" priority to manifest jobs
    manifestJob.priority = 2;
    try {
      this._jobRepository.insertJob(manifestJob);
    } catch (error) {
      this.logger.error(manifestJob._id, `Failed to build search manifest: ${error.message}`);
    }
  }

  public stop(): void {
    this._shouldStop = true;
  }

  public isStopped(): boolean {
    return this._shouldStop;
  }

  public getLogger(): ILogger {
    return this.logger;
  }
}

// Good to have this as a friend function
function throwIfJobInterupted() {
  return function decorator(descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    if (typeof original === 'function') {
      descriptor.value = function (...args) {
        const jobHandler = this as JobHandler;
        if (jobHandler?.isStopped() && !jobHandler?.stopped) {
          jobHandler
            .getLogger()
            .info(descriptor.value, `Resetting Job with ID: ${jobHandler.job._id} because server is being shut down`);
          jobHandler.jobRepository.resetJobStatus(
            jobHandler.job._id,
            'inQueue',
            `Resetting Job with ID: ${jobHandler.job._id} because server is being shut down`
          );

          jobHandler.stopped = true;
          throw new JobStoppedError(`${jobHandler.job._id} is stopped`);
        }
        return original.apply(this, args);
      };
    }
    return descriptor;
  };
}
