import { IJob } from '../entities/job';
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

export abstract class JobHandler {
  private _currJob: IJob;
  public get currJob(): IJob {
    return this._currJob;
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
    job: IJob,
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
    this._commandExecutor = commandExecutor;
    this._cdnConnector = cdnConnector;
    this._repoConnector = repoConnector;
    this._logger = logger;
    this._currJob = job;
    this._jobRepository = jobRepository;
    this._fileSystemServices = fileSystemServices;
    this._shouldStop = false;
    this._config = config;
    this._validator = validator;
    this._repoBranchesRepo = repoBranchesRepo;
  }

  abstract prepStageSpecificNextGenCommands(): void;

  private logErrorMessage(message: string): void {
    this.logger.error(this.currJob._id, message);
  }
  private async update(publishResult: CommandExecutorResponse): Promise<void> {
    if (publishResult) {
      if (publishResult?.status === 'success') {
        const files = this._fileSystemServices.getFilesInDirectory(
          `./${this.currJob.payload.repoName}/build/public`,
          '',
          null,
          null
        );
        await this.jobRepository.updateWithCompletionStatus(this.currJob._id, files);
      } else {
        if (publishResult.error) {
          await this.jobRepository.updateWithErrorStatus(this.currJob._id, publishResult.error);
        } else {
          this.logErrorMessage('PublishResult error is undefined');
        }
      }
      if (publishResult.output) {
        await this.jobRepository.insertNotificationMessages(this.currJob._id, publishResult.output);
      } else {
        this.logErrorMessage('PublishResult output is undefined');
      }
    } else {
      this.logErrorMessage('PublishResult is undefined');
    }
  }

  private cleanup(): void {
    this._fileSystemServices.removeDirectory(`repos/${this.currJob.payload.repoName}`);
  }

  @throwIfJobInterupted()
  private async constructPrefix(): Promise<void> {
    const server_user = this._config.get<string>('GATSBY_PARSER_USER');
    const pathPrefix = await this.getPathPrefix();
    // TODO: Can empty string check be removed?
    if (pathPrefix || pathPrefix === '') {
      this.currJob.payload.pathPrefix = pathPrefix;
      const mutPrefix = pathPrefix.split(`/${server_user}`)[0];
      this.currJob.payload.mutPrefix = mutPrefix;
    }
  }

  @throwIfJobInterupted()
  private async logError(error): Promise<void> {
    await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}failed with code: ${error.code}. `);
    await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}stdErr: ${error.stderr}`);
  }

  @throwIfJobInterupted()
  private async cloneRepo(targetPath: string): Promise<void> {
    await this._logger.save(this.currJob._id, `${'(GIT)'.padEnd(15)}Cloning repository`);
    await this._logger.save(this.currJob._id, `${'(GIT)'.padEnd(15)}running fetch`);
    await this._repoConnector.cloneRepo(this.currJob, targetPath);
  }

  @throwIfJobInterupted()
  private async commitCheck(): Promise<void> {
    // if commit hash is provided, use that
    if (this.currJob?.payload?.newHead && this.currJob?.title !== 'Regression Test Child Process') {
      try {
        const resp = await this._repoConnector.checkCommits(this._currJob);
        // The response output MUST contain the branchName, or else we did not find the commit
        if (!resp?.output?.includes(`* ${this.currJob.payload.branchName}`)) {
          const err = new InvalidJobError(
            `Specified commit does not exist on ${this.currJob.payload.branchName} branch`
          );
          await this._logger.save(
            this.currJob._id,
            `${'(BUILD)'.padEnd(15)} failed. The specified commit does not exist on ${
              this.currJob.payload.branchName
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
      await this._repoConnector.pullRepo(this.currJob);
    } catch (error) {
      await error;
      throw error;
    }
  }

  @throwIfJobInterupted()
  private async downloadMakeFile(): Promise<void> {
    try {
      this._logger.info(
        this.currJob._id,
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${this.currJob.payload.repoName}`
      );
      await this._fileSystemServices.saveUrlAsFile(
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${this.currJob.payload.repoName}`,
        `repos/${this.currJob.payload.repoName}/Makefile`,
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
    const workerPath = `repos/${this.currJob.payload.repoName}/worker.sh`;
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
      await this._validator.throwIfBranchNotConfigured(this.currJob);
      await this.constructPrefix();
      // if this payload is NOT aliased or if it's the primary alias, we need the index path
      if (!this.currJob.payload.aliased || (this.currJob.payload.aliased && this.currJob.payload.primaryAlias)) {
        this.currJob.payload.manifestPrefix = this.constructManifestPrefix();
      }

      this.prepStageSpecificNextGenCommands();
      this.constructEnvVars();
      this.currJob.payload.isNextGen = true;
      if (this._currJob.payload.jobType === 'productionDeploy') {
        this._validator.throwIfNotPublishable(this._currJob);
      }
    } else {
      this.currJob.payload.isNextGen = false;
    }
  }

  @throwIfJobInterupted()
  private async executeBuild(): Promise<boolean> {
    if (this.currJob.buildCommands && this.currJob.buildCommands.length > 0) {
      await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}Running Build`);
      await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}running worker.sh`);
      const resp = await this._commandExecutor.execute(this.currJob.buildCommands);
      await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}Finished Build`);
      await this._logger.save(
        this.currJob._id,
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
    let envVars = `GATSBY_PARSER_USER=${this._config.get<string>('GATSBY_PARSER_USER')}\nGATSBY_PARSER_BRANCH=${
      this.currJob.payload.branchName
    }\n`;
    const pathPrefix = this.currJob.payload.pathPrefix;

    // Frontend expects docs properties deployed to the root of their bucket to have '/' as their prefix.
    if (this._currJob.payload.jobType === 'productionDeploy' && pathPrefix === '') {
      envVars += 'PATH_PREFIX=/\n';
    }
    // TODO: Do we need the empty string check?
    else if (pathPrefix || pathPrefix === '') {
      envVars += `PATH_PREFIX=${pathPrefix}\n`;
    }
    const snootyFrontEndVars = {
      GATSBY_BASE_URL: this._config.get<string>('gatsbyBaseUrl'),
    };

    for (const [envName, envValue] of Object.entries(snootyFrontEndVars)) {
      if (envValue) envVars += `${envName}=${envValue}\n`;
    }
    this._fileSystemServices.writeToFile(`repos/${this.currJob.payload.repoName}/.env.production`, envVars, {
      encoding: 'utf8',
      flag: 'w',
    });
  }

  protected getPathPrefix(): string {
    return '';
  }

  // For certain unversioned properties, urlSlug is null; use branchName instead
  protected constructManifestPrefix(): string {
    if (this.currJob.payload.urlSlug) {
      return `${this.currJob.payload.project}-${this.currJob.payload.urlSlug}`;
    }
    return `${this.currJob.payload.project}-${this.currJob.payload.branchName}`;
  }

  protected abstract deploy(): Promise<CommandExecutorResponse>;

  protected abstract prepDeployCommands(): void;

  protected prepBuildCommands(): void {
    this.currJob.buildCommands = [
      `. /venv/bin/activate`,
      `cd repos/${this.currJob.payload.repoName}`,
      `rm -f makefile`,
      `make html`, // TODO: Can we remove this line, given how many jobHandler functions overwrite it?
    ];
  }

  protected async setEnvironmentVariables(): Promise<void> {
    const repo_info = await this._repoBranchesRepo.getRepoBranchesByRepoName(this._currJob.payload.repoName);
    let env = this._config.get<string>('env');
    this._logger.info(
      this._currJob._id,
      `setEnvironmentVariables for ${this._currJob.payload.repoName} env ${env} jobType ${this._currJob.payload.jobType}`
    );
    if (repo_info?.['bucket'] && repo_info?.['url']) {
      if (this._currJob.payload.regression) {
        env = 'regression';
        process.env.REGRESSION = 'true';
      }
      process.env.BUCKET = repo_info['bucket'][env];
      process.env.URL = repo_info['url'][env];

      // Writers are tying to stage it, so lets update the staging bucket.
      if (env == 'prd' && this._currJob.payload.jobType == 'githubPush') {
        process.env.BUCKET = repo_info['bucket']['stg'];
        process.env.URL = repo_info['url']['stg'];
      }
    }

    if (process.env.BUCKET) {
      this._logger.info(this._currJob._id, process.env.BUCKET);
    }
    if (process.env.URL) {
      this._logger.info(this._currJob._id, process.env.URL);
    }
  }

  @throwIfJobInterupted()
  protected async build(): Promise<boolean> {
    this.cleanup();
    await this.cloneRepo(this._config.get<string>('repo_dir'));
    this._logger.info(this._currJob._id, 'Cloned Repo');
    await this.commitCheck();
    this._logger.info(this._currJob._id, 'Checked Commit');
    await this.pullRepo();
    this._logger.info(this._currJob._id, 'Pulled Repo');
    this.prepBuildCommands();
    this._logger.info(this._currJob._id, 'Prepared Build commands');
    await this.prepNextGenBuild();
    this._logger.info(this._currJob._id, 'Prepared Next Gen build');
    await this._repoConnector.applyPatch(this.currJob);
    this._logger.info(this._currJob._id, 'Patch Applied');
    await this.downloadMakeFile();
    this._logger.info(this._currJob._id, 'Downloaded Makefile');
    await this.setEnvironmentVariables();
    this._logger.info(this._currJob._id, 'prepared Environment variables');
    return await this.executeBuild();
  }

  @throwIfJobInterupted()
  protected async deployGeneric(): Promise<CommandExecutorResponse> {
    this.prepDeployCommands();
    await this._logger.save(this.currJob._id, `${this._config.get<string>('stage').padEnd(15)}Pushing to ${this.name}`);

    if ((this.currJob?.deployCommands?.length ?? 0) > 0) {
      const resp = await this._commandExecutor.execute(this.currJob.deployCommands);
      if (resp?.error?.includes('ERROR')) {
        await this._logger.save(
          this.currJob._id,
          `${this._config.get<string>('stage').padEnd(15)}Failed to push to ${this.name}`
        );
        throw new PublishError(`Failed pushing to ${this.name}: ${resp.error}`);
      }
      await this._logger.save(
        this.currJob._id,
        `${this._config.get<string>('stage').padEnd(15)}Finished pushing to ${this.name}`
      );
      await this._logger.save(
        this.currJob._id,
        `${this._config.get<string>('stage').padEnd(15)}push details:\n\n${resp.output}`
      );
      return resp;
    } else {
      await this._logger.save(
        this.currJob._id,
        `${this._config.get<string>('stage').padEnd(15)}Pushing to ${
          this.name
        } failed as there is no commands to execute`
      );
      throw new PublishError(`Failed pushing to ${this.name}, No commands to execute`);
    }
  }

  @throwIfJobInterupted()
  public async execute(): Promise<void> {
    await this._logger.save(
      this._currJob._id,
      `* Starting Job with ID: ${this._currJob._id} and type: ${this._currJob.payload.jobType}`
    );
    try {
      await this.build();
      const resp = await this.deploy();
      await this.update(resp);
      this.cleanup();
    } catch (error) {
      try {
        await this._jobRepository.updateWithErrorStatus(this._currJob._id, error.message);
        this.cleanup();
      } catch (error) {
        this._logger.error(this._currJob._id, error.message);
      }
    }
  }

  public stop(): void {
    this._shouldStop = true;
  }

  public isStopped(): boolean {
    return this._shouldStop;
  }

  public getLogger(): ILogger {
    return this._logger;
  }
}

// Good to have this as a friend function
function throwIfJobInterupted() {
  return function decorator(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    if (typeof original === 'function') {
      descriptor.value = function (...args) {
        const jobHandler = this as JobHandler;
        if (jobHandler?.isStopped() && !jobHandler?.stopped) {
          jobHandler
            .getLogger()
            .info(
              descriptor.value,
              `Resetting Job with ID: ${jobHandler.currJob._id} because server is being shut down`
            );
          jobHandler.jobRepository.resetJobStatus(
            jobHandler.currJob._id,
            'inQueue',
            `Resetting Job with ID: ${jobHandler.currJob._id} because server is being shut down`
          );

          jobHandler.stopped = true;
          throw new JobStoppedError(`${jobHandler.currJob._id} is stopped`);
        }
        return original.apply(this, args);
      };
    }
    return descriptor;
  };
}
