import axios, { AxiosResponse } from 'axios';
import { Payload, Job, JobStatus } from '../entities/job';
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
import { RepoEntitlementsRepository } from '../repositories/repoEntitlementsRepository';
import { DocsetsRepository } from '../repositories/docsetsRepository';
import { MONOREPO_NAME } from '../monorepo/utils/monorepo-constants';
import { nextGenHtml, nextGenParse, oasPageBuild, persistenceModule, prepareBuild } from '../commands';
import { downloadBuildDependencies } from '../commands/src/helpers/dependency-helpers';
import { CliCommandResponse } from '../commands/src/helpers';
require('fs');

export abstract class JobHandler {
  private _currJob: Job;
  public get currJob(): Job {
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
  protected _docsetsRepo: DocsetsRepository;
  protected _repoEntitlementsRepo: RepoEntitlementsRepository;

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
    this._docsetsRepo = docsetsRepo;
    this._repoEntitlementsRepo = repoEntitlementsRepo;
  }

  // called during build stage of
  abstract prepStageSpecificNextGenCommands(): void;

  private logErrorMessage(message: string): void {
    this.logger.error(this.currJob._id, message);
  }
  private async update(publishResult: CommandExecutorResponse): Promise<void> {
    if (publishResult) {
      if (publishResult?.status === 'success') {
        const files = this._fileSystemServices.getFilesInDirectory(
          `./${getDirectory(this.currJob)}/build/public`,
          '',
          null,
          null
        );

        // Prevent the Autobuilder's usual build completion from being sent after content staging job
        // if the user already has a Gatsby Cloud site. Job should be marked as
        // completed after the Gatsby Cloud build via the SnootyBuildComplete lambda.
        const { _id: jobId, user } = this.currJob;
        const gatsbyCloudSiteId = await this._repoEntitlementsRepo.getGatsbySiteIdByGithubUsername(user);
        if (
          gatsbyCloudSiteId &&
          this.currJob.payload.jobType === 'githubPush' &&
          process.env.IS_FEATURE_BRANCH !== 'true'
        ) {
          this.logger.info(
            jobId,
            `User ${user} has a Gatsby Cloud site. The Autobuilder will not mark the build as completed right now.`
          );
        } else {
          await this.jobRepository.updateWithStatus(jobId, files, JobStatus.completed);
        }
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
    this._fileSystemServices.removeDirectory(`repos/${getDirectory(this.currJob)}`);
  }

  @throwIfJobInterupted()
  private async constructPrefix(): Promise<void> {
    const server_user = this._config.get<string>('GATSBY_PARSER_USER');
    const pathPrefix = await this.getPathPrefix();
    // TODO: Can empty string check be removed?
    if (pathPrefix || pathPrefix === '') {
      this.currJob.payload.pathPrefix = pathPrefix;
      //sets mutPrefix to the full pathPrefix unless server user is in the path (I believe this only happens in a subset of cases when docs-worker-xlarge is the server-user)
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
  private async getAndDownloadBuildDependencies() {
    const repoName = this.currJob.payload.repoName;
    const directory = this.currJob.payload.repoName === MONOREPO_NAME ? this.currJob.payload.directory : undefined;
    const buildDependencies = await this._repoBranchesRepo.getBuildDependencies(repoName, directory);
    if (!buildDependencies) return;
    await this._logger.save(this._currJob._id, 'Identified Build dependencies');
    const commands = await downloadBuildDependencies(buildDependencies, this.currJob.payload.repoName, directory);
    await this._logger.save(this._currJob._id, `${commands.join('\n')}`);
    const err = commands.find((element) => element.includes('ERROR'));
    if (err) throw new Error('Could not download some dependencies');
  }

  @throwIfJobInterupted()
  private async downloadMakeFile(): Promise<void> {
    try {
      const makefileFileName =
        this.currJob.payload.repoName === MONOREPO_NAME
          ? this.currJob.payload.directory
          : this.currJob.payload.repoName;
      await this._fileSystemServices.saveUrlAsFile(
        `https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${makefileFileName}`,
        `repos/${getDirectory(this.currJob)}/Makefile`,
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
    const workerPath = `repos/${getDirectory(this.currJob)}/worker.sh`;
    if (this._fileSystemServices.rootFileExists(workerPath)) {
      const workerContents = this._fileSystemServices.readFileAsUtf8(workerPath);
      const workerLines = workerContents.split(/\r?\n/);
      return workerLines.includes('"build-and-stage-next-gen"');
    }
    return false;
  }

  @throwIfJobInterupted()
  private async prepNextGenBuild(): Promise<void> {
    await this._validator.throwIfBranchNotConfigured(this.currJob);
    await this.constructPrefix();
    // TODO: Look into moving the generation of manifestPrefix into the manifestJobHandler,
    // as well as reducing difficult-to-debug state changes
    // if this payload is NOT aliased or if it's the primary alias, we need the index path
    if (!this.currJob.payload.aliased || (this.currJob.payload.aliased && this.currJob.payload.primaryAlias)) {
      this.currJob.payload.manifestPrefix = this.constructManifestPrefix();
      this._logger.info(this.currJob._id, `Created payload manifestPrefix: ${this.currJob.payload.manifestPrefix}`);
    }

    this.prepStageSpecificNextGenCommands();
    this.constructEnvVars();
    if (this._currJob.payload.jobType === 'productionDeploy') {
      this._validator.throwIfNotPublishable(this._currJob);
    }
  }

  private async logBuildDetails(resp: CommandExecutorResponse): Promise<void> {
    await this._logger.save(
      this.currJob._id,
      `${'(BUILD)'.padEnd(15)}worker.sh run details:\n\n${resp.output}\n---\n${resp.error}`
    );
    if (resp.status != 'success') {
      const error = new AutoBuilderError(resp.error, 'BuildError');
      await this.logError(error);
      throw error;
    }
  }

  // call this method when we want benchmarks and uses cwd option to call command outside of a one liner.
  private async wrapWithBenchmarks(
    buildStepFunc: () => Promise<CliCommandResponse>,
    stage: string
  ): Promise<CliCommandResponse> {
    const start = performance.now();

    const resp = await buildStepFunc();

    const end = performance.now();

    const update = {
      [`${stage}StartTime`]: start,
      [`${stage}EndTime`]: end,
    };

    this._jobRepository.updateExecutionTime(this.currJob._id, update);
    return resp;
  }

  // call this method when we want benchmarks of Makefile commands and uses cwd option to call command outside of a one liner.
  private async callWithBenchmark(command: string, stage: string): Promise<CommandExecutorResponse> {
    const start = performance.now();
    const pathToRepo = `repos/${getDirectory(this.currJob)}`;
    const resp = await this._commandExecutor.execute([command], pathToRepo);

    await this._logger.save(this.currJob._id, `${'(COMMAND)'.padEnd(15)} ${command} run details in ${pathToRepo}`);
    const end = performance.now();
    const update = {
      [`${stage}StartTime`]: start,
      [`${stage}EndTime`]: end,
    };

    this._jobRepository.updateExecutionTime(this.currJob._id, update);
    return resp;
  }

  private async exeBuildModified(): Promise<void> {
    const stages = {
      ['get-build-dependencies']: 'buildDepsExe',
      ['next-gen-parse']: 'parseExe',
      ['persistence-module']: 'persistenceExe',
      ['next-gen-html']: 'htmlExe',
      ['oas-page-build']: 'oasPageBuildExe',
    };

    // get the prerequisite commands which should be all commands up to `rm -f makefile`
    const endOfPrerequisiteCommands = this.currJob.buildCommands.indexOf('rm -f makefile');
    const index = endOfPrerequisiteCommands + 1;
    const prerequisiteCommands = this.currJob.buildCommands.slice(0, index);
    await this._logger.save(
      this.currJob._id,
      `${'(PREREQUISITE COMMANDS)'.padEnd(15)} ${prerequisiteCommands.join(' && ')}`
    );

    const makeCommands = this.currJob.buildCommands.slice(index);
    await this._logger.save(this.currJob._id, `${'(MAKE COMMANDS)'.padEnd(15)} ${makeCommands.join(' && ')}`);

    // call prerequisite commands
    await this._commandExecutor.execute(prerequisiteCommands);

    for (const command of makeCommands) {
      // works for any make command with the following signature make <make-rule>
      const key = command.split(' ')[1].trim();
      if (stages[key]) {
        const makeCommandsWithBenchmarksResponse = await this.callWithBenchmark(command, stages[key]);
        await this.logBuildDetails(makeCommandsWithBenchmarksResponse);
      } else {
        const makeCommandsResp = await this._commandExecutor.execute([command]);
        await this.logBuildDetails(makeCommandsResp);
      }

      // Call Gatsby Cloud preview webhook after persistence module finishes for staging builds
      const isFeaturePreviewWebhookEnabled = process.env.GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED?.toLowerCase() === 'true';
      if (
        key === 'persistence-module' &&
        this.name === 'Staging' &&
        isFeaturePreviewWebhookEnabled &&
        process.env.IS_FEATURE_BRANCH !== 'true'
      ) {
        await this.callGatsbyCloudWebhook();
        await this.callNetlifyWebhook();
      }
    }
    await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}Finished Build`);
  }

  @throwIfJobInterupted()
  private async executeBuild(): Promise<boolean> {
    if (this.currJob.buildCommands && this.currJob.buildCommands.length > 0) {
      await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}Running Build`);
      await this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}running worker.sh`);
      await this.exeBuildModified();
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
      PREVIEW_BUILD_ENABLED: this._config.get<string>('previewBuildEnabled'),
      GATSBY_TEST_SEARCH_UI: this._config.get<string>('featureFlagSearchUI'),
      GATSBY_HIDE_UNIFIED_FOOTER_LOCALE: this._config.get<string>('gatsbyHideUnifiedFooterLocale'),
      GATSBY_MARIAN_URL: this._config.get<string>('gatsbyMarianURL'),
    };

    for (const [envName, envValue] of Object.entries(snootyFrontEndVars)) {
      if (envValue) envVars += `${envName}=${envValue}\n`;
    }
    const fileToWriteTo = `repos/${getDirectory(this.currJob)}/.env.production`;
    this._fileSystemServices.writeToFile(fileToWriteTo, envVars, {
      encoding: 'utf8',
      flag: 'w',
    });
  }

  protected getPathPrefix(): string {
    return '';
  }

  // TODO: Reduce hard-to-follow state mutations
  public constructManifestPrefix(): string {
    // In the past, we have had issues with generating manifests titled "null-v1.0.json"
    // This is rudimentary error handling, and should ideally happen elsewhere
    if (!this.currJob.payload.project) {
      this._logger.info(this._currJob._id, `Project name not found for ${this.currJob._id}.`);
      throw new InvalidJobError(`Project name not found for ${this.currJob._id}.`);
    }
    if (this.currJob.payload.aliased) {
      this._logger.info(this._currJob._id, `Warning: generating manifest prefix for aliased property.`);
    }
    // Due to snooty.toml project naming discrepancies, payload.project may not
    // match preferred project names. This may be removed pending snooty.toml
    // name correction AND snooty frontend dropdown de-hardcoding
    const substitute = {
      cloudgov: 'AtlasGov',
      'cloud-docs': 'atlas',
      docs: 'manual',
    };
    const projectName = substitute[this.currJob.payload.project] ?? this.currJob.payload.project;

    if (this.currJob.payload.urlSlug) {
      return `${projectName}-${this.currJob.payload.urlSlug}`;
    }
    // For certain unversioned properties, urlSlug is null; use branchName instead
    return `${projectName}-${this.currJob.payload.branchName}`;
  }

  protected abstract deploy(): Promise<CommandExecutorResponse>;

  protected abstract prepDeployCommands(): void;

  protected prepSearchDeploy(): void {
    this._logger.info(this._currJob._id, 'Preparing search deploy');
  }

  // TODO: Reduce state changes
  protected prepBuildCommands(): void {
    this.currJob.buildCommands = [`cd repos/${getDirectory(this.currJob)}`, `rm -f makefile`, `make next-gen-html`];
  }

  public async getEnvironmentVariables(): Promise<{ bucket?: string; url?: string; regression?: string }> {
    let bucket: string | undefined, url: string | undefined, regression: string | undefined;

    const repo_info = await this._docsetsRepo.getRepoBranchesByRepoName(
      this._currJob.payload.repoName,
      this._currJob.payload.project
    );

    let env = this._config.get<string>('env');
    this._logger.info(
      this._currJob._id,
      `getEnvironmentVariables for ${getDirectory(this._currJob)} env ${env} jobType ${this._currJob.payload.jobType}`
    );
    if (repo_info?.['bucket'] && repo_info?.['url']) {
      if (this._currJob.payload.regression) {
        env = 'regression';
        regression = 'true';
      }
      bucket = repo_info['bucket'][env];
      url = repo_info['url'][env];

      // Writers are tying to stage it, so lets update the staging bucket.
      if (env == 'prd' && this._currJob.payload.jobType == 'githubPush') {
        bucket = repo_info['bucket'][env] + '-staging';
        url = repo_info['url']['stg'];
      }
    }

    if (!bucket || !url) {
      this._logger.error(
        this._currJob._id,
        `getEnvironmentVariables failed to access AWS bucket and url necessary for ${getDirectory(
          this._currJob
        )} env ${env} jobType ${this._currJob.payload.jobType}`
      );
    }

    if (bucket) {
      this._logger.info(this._currJob._id, bucket);
    }
    if (url) {
      this._logger.info(this._currJob._id, url);
    }

    return {
      bucket,
      url,
      regression,
    };
  }

  protected async setEnvironmentVariables(): Promise<void> {
    const { bucket, url, regression } = await this.getEnvironmentVariables();

    process.env.BUCKET = bucket;
    process.env.URL = url;
    process.env.REGRESSION = regression;
  }

  @throwIfJobInterupted()
  protected async buildWithMakefiles(): Promise<boolean> {
    this.cleanup();
    await this.cloneRepo(this._config.get<string>('repo_dir'));
    this._logger.save(this._currJob._id, 'Cloned Repo');
    await this.commitCheck();
    this._logger.save(this._currJob._id, 'Checked Commit');
    await this.pullRepo();
    this._logger.save(this._currJob._id, 'Pulled Repo');
    this.prepBuildCommands();
    this._logger.save(this._currJob._id, 'Prepared Build commands');
    await this.prepNextGenBuild();
    this._logger.save(this._currJob._id, 'Prepared Next Gen build');
    await this._repoConnector.applyPatch(this._currJob);
    this._logger.save(this._currJob._id, 'Patch Applied');
    await this.downloadMakeFile();
    this._logger.save(this._currJob._id, 'Downloaded Makefile');
    await this.setEnvironmentVariables();
    this._logger.save(this._currJob._id, 'Prepared Environment variables');
    return await this.executeBuild();
  }

  /* New build process without Makefiles */
  @throwIfJobInterupted()
  protected async build(): Promise<boolean> {
    this.cleanup();
    const job = this._currJob;

    await this.cloneRepo(this._config.get<string>('repo_dir'));
    this._logger.save(job._id, 'Cloned Repo');

    await this.commitCheck();
    this._logger.save(job._id, 'Checked Commit');
    await this.pullRepo();
    this._logger.save(job._id, 'Pulled Repo');
    await this.setEnvironmentVariables();
    this.logger.save(job._id, 'Prepared Environment variables');

    await this.getAndDownloadBuildDependencies();
    this._logger.save(this._currJob._id, 'Downloaded Build dependencies');

    const docset = await this._docsetsRepo.getRepo(this._currJob.payload.repoName, this._currJob.payload.directory);
    let env = this._config.get<string>('env');
    if (this._currJob.payload.regression) {
      env = 'regression';
    }
    const baseUrl = docset?.url?.[env] || 'https://mongodbcom-cdn.website.staging.corp.mongodb.com';

    const { patchId } = await prepareBuild(job.payload.repoName, job.payload.project, baseUrl, job.payload.directory);
    // Set patchId on payload for use in nextGenStage
    this._currJob.payload.patchId = patchId;

    let buildStepOutput: CliCommandResponse;

    const parseFunc = async () => nextGenParse({ job, patchId });
    buildStepOutput = await this.wrapWithBenchmarks(parseFunc, 'parseExe');
    this.logger.save(job._id, 'Repo Parsing Complete');
    this.logger.save(job._id, `${buildStepOutput.outputText}\n${buildStepOutput.errorText}`);

    const persistenceFunc = async () => persistenceModule({ job });
    buildStepOutput = await this.wrapWithBenchmarks(persistenceFunc, 'persistenceExe');
    await this.logger.save(job._id, 'Persistence Module Complete');
    await this.logger.save(job._id, `${buildStepOutput.outputText}\n${buildStepOutput.errorText}`);

    // Call Gatsby Cloud preview webhook after persistence module finishes for staging builds
    const isFeaturePreviewWebhookEnabled = process.env.GATSBY_CLOUD_PREVIEW_WEBHOOK_ENABLED?.toLowerCase() === 'true';
    if (this.name === 'Staging' && isFeaturePreviewWebhookEnabled) {
      await this.callGatsbyCloudWebhook();
      await this.logger.save(job._id, 'Gatsby Webhook Called');
      await this.callNetlifyWebhook();
    }

    const oasPageBuilderFunc = async () => oasPageBuild({ job, baseUrl });
    buildStepOutput = await this.wrapWithBenchmarks(oasPageBuilderFunc, 'oasPageBuildExe');
    await this.logger.save(job._id, 'OAS Page Build Complete');
    await this.logger.save(job._id, `${buildStepOutput.outputText}\n${buildStepOutput.errorText}`);

    const htmlFunc = async () => await nextGenHtml();
    buildStepOutput = await this.wrapWithBenchmarks(htmlFunc, 'htmlExe');
    await this.logger.save(job._id, 'NextGenHtml Complete');
    await this.logger.save(job._id, `${buildStepOutput.outputText}\n${buildStepOutput.errorText}`);

    return true;
  }

  @throwIfJobInterupted()
  protected async deployGeneric(): Promise<CommandExecutorResponse> {
    this.prepDeployCommands();
    await this._logger.save(this.currJob._id, `${this._config.get<string>('stage').padEnd(15)}Pushing to ${this.name}`);

    if ((this.currJob?.deployCommands?.length ?? 0) > 0) {
      await this._logger.save(this.currJob._id, `deploy commands: ${this.currJob.deployCommands.join(' ')}`);
      // extract search deploy job to time and test
      const searchCommandIdx = this.currJob.deployCommands.findIndex((c) => c.match(/^mut\-index/));
      let deployCmdsNoSearch = this.currJob.deployCommands;
      if (searchCommandIdx > -1) {
        await this.callWithBenchmark(this.currJob.deployCommands[searchCommandIdx], 'search');
        deployCmdsNoSearch = this.currJob.deployCommands
          .slice(0, searchCommandIdx)
          .concat(this.currJob.deployCommands.slice(searchCommandIdx + 1, this.currJob.deployCommands.length));
      }

      const resp = await this._commandExecutor.execute(deployCmdsNoSearch);
      if (resp?.error?.includes?.('ERROR')) {
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
    await this._logger.save(this._currJob._id, `* Starting Job with repo name: ${this._currJob.payload.repoName}`);
    try {
      if (process.env.FEATURE_FLAG_MONOREPO_PATH === 'true' && this._currJob.payload.repoName === MONOREPO_NAME) {
        await this._logger.save(this._currJob._id, `* Using build without Makefiles`);
        await this.build();
      } else {
        await this._logger.save(this._currJob._id, `* Using build with Makefiles`);
        await this.buildWithMakefiles();
      }

      const resp = await this.deploy();
      await this.update(resp);
      this.cleanup();
    } catch (error) {
      this.logger.save(this._currJob._id, `Error during the build process: ${error.stack}`);
      try {
        await this._jobRepository.updateWithErrorStatus(this._currJob._id, error.message);

        this.cleanup();
      } catch (error) {
        this._logger.error(this._currJob._id, error.message);
      }
    }
  }

  // This function decides whether or not we should queue up a search manifest job
  // based on information about this build&deploy job
  // TODO: Give 'shouldGenerateSearchManifest' boolean to users' control
  shouldGenerateSearchManifest(): boolean {
    const doNotSearchProperties = ['docs-landing', 'docs-404', 'docs-meta'];
    const localDirectory = getDirectory(this.currJob);
    if (doNotSearchProperties.some((property) => localDirectory.includes(property))) {
      return false;
    }
    // Ensures that we only build a manifest for aliased properties if the job
    // is for a primary alias
    if (this.currJob.payload.aliased && !this.currJob.payload.primaryAlias) {
      return false;
    }
    // Edit this if you want to generate search manifests for dev environments, too
    if (this.currJob.payload.jobType !== 'productionDeploy') {
      return false;
    }
    return true;
  }

  // For most build & deploy jobs, we create and queue an associated job to
  // generate a search manifest (a.k.a. search index), and upload it to the S3
  // bucket via mut (handled in manifestJobHandler.ts)
  @throwIfJobInterupted()
  public async queueManifestJob(): Promise<void> {
    this._logger.info(this.currJob._id, `Queueing associated search manifest job for job ${this.currJob.title}.`);

    // Ensure there is always a manifestPrefix to upload to
    let backupManifestPrefix = '';
    if (!this._currJob.manifestPrefix && !this._currJob.payload.manifestPrefix) {
      backupManifestPrefix = this.constructManifestPrefix();
      this._logger.info(this.currJob._id, `Using backup manifestPrefix: ${backupManifestPrefix}.`);
    }

    // Rudimentary error prevention (manifest jobs should not queue new manifest jobs - autobuilder will explode)
    if (this._currJob.payload.jobType.includes('manifestGeneration')) {
      this._logger.error(
        this._currJob._id,
        `Incorrectly attempted to queue another search manifest job 
      based on known ManifestJob '${this._currJob._id}'. Please contact documentation platform team.`
      );
      return;
    }
    if (!this._currJob.shouldGenerateSearchManifest) {
      this._logger.error(
        this._currJob._id,
        `Incorrectly attempted to queue undesired search manifest job. Stopping queueManifestJob().`
      );
      return;
    }

    const manifestPayload: Payload = this._currJob.payload;
    manifestPayload.jobType = 'manifestGeneration';
    const manifestJob: Omit<Job, '_id'> = {
      buildCommands: [],
      comMessage: [],
      createdTime: new Date(),
      deployCommands: [],
      email: '',
      endTime: null,
      error: null,
      invalidationStatusURL: '',
      logs: [],
      // Note: Be cautious - there are prefixes from both job and payload
      manifestPrefix: this._currJob.manifestPrefix ?? this._currJob.payload.manifestPrefix ?? backupManifestPrefix,
      mutPrefix: this._currJob.mutPrefix ?? this._currJob.payload.mutPrefix,
      pathPrefix: this._currJob.pathPrefix ?? this._currJob.payload.pathPrefix,
      payload: manifestPayload,
      // NOTE: Priority must be 2 or greater to avoid manifest jobs being
      // prioritized alongside/above build jobs (which have a priority of 1)
      priority: 1, // testing with priority 1
      purgedUrls: [],
      result: null,
      // manifestJobs should never attempt to queue secondary manifestJobs
      shouldGenerateSearchManifest: false,
      startTime: new Date(),
      status: JobStatus.inQueue,
      title: this._currJob.title + ' - search manifest generation',
      user: this._currJob.user,
    };

    try {
      const jobId = await this._jobRepository.insertJob(manifestJob, this._config.get('jobsQueueUrl'));
      this._logger.info(
        manifestJob.title,
        `Inserted manifestGeneration job: ${jobId} for prefix ${manifestJob.manifestPrefix}.`
      );
    } catch (error) {
      this._logger.error(
        manifestJob.title,
        `Failed to queue search manifest job for build job '${this._currJob._id}'. 
      Error: ${error.message}. Search results for this property will not be updated.`
      );
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

  // Invokes Gatsby Cloud Preview Webhook
  protected async callGatsbyCloudWebhook(): Promise<void> {
    const previewWebhookURL = 'https://webhook.gatsbyjs.com/hooks/data_source';
    const githubUsername = this.currJob.user;
    const logPrefix = '(POST Gatsby Cloud Webhook Status)';

    try {
      const gatsbySiteId = await this._repoEntitlementsRepo.getGatsbySiteIdByGithubUsername(githubUsername);
      if (!gatsbySiteId) {
        const message = `User ${githubUsername} does not have a Gatsby Cloud Site ID.`;
        this._logger.warn('Gatsby Cloud Preview Webhook', message);
        return;
      }

      const url = `${previewWebhookURL}/${gatsbySiteId}`;
      const response = await this.callExternalBuildHook(url, 'gatsbyCloudStartTime');
      await this.logger.save(this.currJob._id, `${logPrefix.padEnd(15)} ${response.status}`);
    } catch (err) {
      await this.logger.save(
        this.currJob._id,
        `${logPrefix.padEnd(15)} Failed to POST to Gatsby Cloud webhook: ${err}`
      );
      throw err;
    }
  }

  // Invokes Netlify Build Hook
  protected async callNetlifyWebhook(): Promise<void> {
    const githubUsername = this.currJob.user;
    const logPrefix = '(EXPERIMENTAL - POST Netlify Webhook Status)';

    try {
      const url = await this._repoEntitlementsRepo.getNetlifyBuildHookByGithubUsername(githubUsername);
      if (!url) {
        const message = `User ${githubUsername} does not have a Netlify build hook.`;
        this._logger.warn('Netlify Build Hook', message);
        return;
      }

      const res = await this.callExternalBuildHook(url, 'netlifyStartTime');
      await this.logger.save(this.currJob._id, `${logPrefix.padEnd(15)} ${res.status}`);
    } catch (err) {
      // Intentionally log and don't throw error since this is currently experimental and shouldn't block build progress
      const errorMsg = `${logPrefix.padEnd(
        15
      )} Failed to POST to Netlify webhook. This should not affect completion of the build: ${err}`;
      await this.logger.save(this.currJob._id, errorMsg);
    }
  }

  protected async callExternalBuildHook(url: string, startTimeKey: string): Promise<AxiosResponse> {
    const jobId = this.currJob._id;
    const payload = { jobId };
    const config = {
      headers: { 'x-gatsby-cloud-data-source': 'gatsby-source-snooty-preview' },
    };

    const res = await axios.post(url, payload, config);
    await this._jobRepository.updateExecutionTime(jobId, { [startTimeKey]: new Date() });
    return res;
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

export function getDirectory(job: Job) {
  const { payload } = job;
  let directory = payload.repoName;
  if (payload.repoName === MONOREPO_NAME && !!payload.directory) directory += `/${payload.directory}`;
  return directory;
}
