import { IJob } from "../entities/job";
import { JobRepository } from "../repositories/jobRepository";
import { ICDNConnector } from "../services/cdn";
import { CommandExecutorResponse, ICommandExecutor, IJobCommandExecutor } from "../services/commandExecutor";
import { IJobRepoLogger, ILogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";
import { IFileSystemServices } from "../services/fileServices";
import { AutoBuilderError, InvalidJobError, JobStoppedError, PublishError } from "../errors/errors";
import { IConfig } from "config";
import TestableArrayWrapper  from "./ITestableTypeWrapper";

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

    protected _config: IConfig;

    protected name:string;

    constructor(job: IJob, config: IConfig, jobRepository: JobRepository, fileSystemServices: IFileSystemServices, commandExecutor: IJobCommandExecutor,
        cdnConnector: ICDNConnector, repoConnector: IRepoConnector, logger: IJobRepoLogger) {
        this._commandExecutor = commandExecutor;
        this._cdnConnector = cdnConnector;
        this._repoConnector = repoConnector;
        this._logger = logger;
        this._currJob = job;
        this._jobRepository = jobRepository;
        this._fileSystemServices = fileSystemServices;
        this._shouldStop = false;
        this._config = config;
    }

    abstract prepStageSpecificNextGenCommands(): void;

    private async update(publishResult:CommandExecutorResponse): Promise<void> {
        if (publishResult && publishResult.status === 'success') {
            let files = this._fileSystemServices.getFilesInDirectory(`./${this.currJob.payload.repoName}/build/public`, '');
            await this.jobRepository.updateWithCompletionStatus(this.currJob._id, files);
        } else {
            await this.jobRepository.updateWithErrorStatus(this.currJob._id, publishResult.error);
        }
        await this.jobRepository.insertNotificationMessages(this.currJob._id, publishResult.output);
    }

    private cleanup(): void {
        this._fileSystemServices.removeDirectory(`repos/${this.currJob.payload.repoName}`);
    }

    @throwIfJobInterupted()
    private async constructPrefix(): Promise<void> {
        const server_user = this._config.get<string>("GATSBY_PARSER_USER");
        let pathPrefix = await this.getPathPrefix();
        if (typeof pathPrefix !== 'undefined' && pathPrefix !== null) {
            this.currJob.payload.pathPrefix = pathPrefix;
            const mutPrefix = pathPrefix.split(`/${server_user}`)[0];
            this.currJob.payload.mutPrefix = mutPrefix;
        }
    }

    @throwIfJobInterupted()
    private logError(error): void {
        this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}failed with code: ${error.code}. `);
        this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}stdErr: ${error.stderr}`);
    }

    @throwIfJobInterupted()
    private async cloneRepo(): Promise<void> {
        this._logger.save(this.currJob._id, `${'(GIT)'.padEnd(15)}Cloning repository`);
        this._logger.save(this.currJob._id, `${'(GIT)'.padEnd(15)}running fetch`);
        await this._repoConnector.cloneRepo(this.currJob);
    }

    @throwIfJobInterupted()
    private async commitCheck(): Promise<void> {
        // if commit hash is provided, use that
        if (this.currJob.payload.newHead && this.currJob.title !== 'Regression Test Child Process') {
            try {
                const resp = await this._repoConnector.checkCommits(this._currJob);
                if (!resp || !resp.output || (resp.output && !resp.output.includes(`* ${this.currJob.payload.branchName}`))) {
                    const err = new InvalidJobError(`Specified commit does not exist on ${this.currJob.payload.branchName} branch`);
                    this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)} failed. The specified commit does not exist on ${this.currJob.payload.branchName} branch.`);
                    throw err;
                }
            } catch (error) {
                if (!(error instanceof AutoBuilderError)) {
                    this.logError(error);
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
            this.logError(error);
            throw error;
        }
    }

    @throwIfJobInterupted()
    private async downloadMakeFile(): Promise<void> {
        try {
            await this._fileSystemServices.saveUrlAsFile(`https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/Makefile.${this.currJob.payload.repoName}`,
                `repos/${this.currJob.payload.repoName}/Makefile`, {
                encoding: 'utf8',
                flag: 'w'
            });
        } catch (error) {
            this.logError(error);
            throw error;
        }
    }

    @throwIfJobInterupted()
    private isbuildNextGen(): boolean {
        const workerPath = `repos/${this.currJob.payload.repoName}/worker.sh`;
        if (this._fileSystemServices.rootFileExists(workerPath)) {
            const workerContents = this._fileSystemServices.readFileAsUtf8(workerPath);
            const workerLines = workerContents.split(/\r?\n/);
            for (let i = 0; i < workerLines.length; i++) {
                if (workerLines[i] === '"build-and-stage-next-gen"') {
                    return true;
                }
            }
        }
        return false;
    }

    @throwIfJobInterupted()
    private async prepNextGenBuild(): Promise<void> {
        if (this.isbuildNextGen()) {
            await this.constructPrefix();
            if (!this.currJob.payload.aliased || (this.currJob.payload.aliased && this.currJob.payload.primaryAlias)) {
                await this.constructManifestIndexPath();
            }
            this.prepStageSpecificNextGenCommands();
            this.constructEnvVars();
            this.currJob.payload.isNextGen = true;
        } else {
            this.currJob.payload.isNextGen = false;
        }
    }

    @throwIfJobInterupted()
    private async executeBuild(): Promise<boolean> {
        const testableArrayWrapper = new TestableArrayWrapper();
        if (this.currJob.buildCommands && new TestableArrayWrapper().length(this.currJob.buildCommands) > 0) {
            
            this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}Running Build`);
            this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}running worker.sh`);
            let resp = await this._commandExecutor.execute(this.currJob.buildCommands);
            this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}Finished Build`);
            this._logger.save(this.currJob._id, `${'(BUILD)'.padEnd(15)}worker.sh run details:\n\n${resp.output}\n---\n${resp.error}`);
            if (resp.status != 'success') {
                const error = new AutoBuilderError(resp.error, "BuildError")
                this.logError(error);
                throw error 
            }
        } else {
            const error = new AutoBuilderError("No commands to execute", "BuildError")
            this.logError(error);
            throw error 
        }
        return true;
    }

    private constructEnvVars(): void {
        let envVars = `GATSBY_PARSER_USER=${ this._config.get<string>("GATSBY_PARSER_USER")}\nGATSBY_PARSER_BRANCH=${this.currJob.payload.branchName}\n`;
        const pathPrefix = this.currJob.payload.pathPrefix;
        if(typeof pathPrefix !== 'undefined' && pathPrefix !== null){
          envVars += `PATH_PREFIX=${pathPrefix}\n`
        }
        const snootyFrontEndVars = {
          'GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION': this._config.get<boolean>("GATSBY_FEATURE_FLAG_CONSISTENT_NAVIGATION"),
          'GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN': this._config.get<boolean>("GATSBY_FEATURE_FLAG_SDK_VERSION_DROPDOWN"),
        };
    
        for (const[envName, envValue] of Object.entries(snootyFrontEndVars)) {
          if (envValue) envVars += `${envName}=TRUE\n`;
        }
        this._fileSystemServices.writeToFile(`repos/${this.currJob.payload.repoName}/.env.production`, envVars,  { encoding: 'utf8', flag: 'w' });
    }

    protected getPathPrefix(): Promise<string> {
        return Promise.resolve("");
    }

    protected constructManifestIndexPath(): Promise<void> {
        return Promise.resolve();
    }

    protected abstract deploy(): Promise<CommandExecutorResponse>;

    protected abstract prepDeployCommands(): void;

    protected prepBuildCommands(): void {
        this.currJob.buildCommands = [
            `. /venv/bin/activate`,
            `cd repos/${ this.currJob.payload.repoName}`,
            `rm -f makefile`,
            `make html`
        ];
    }

    @throwIfJobInterupted()
    protected async build(): Promise<boolean> {
            this.cleanup();
            await this.cloneRepo();
            await this.commitCheck();
            await this.pullRepo();
            await this._repoConnector.applyPatch(this.currJob);
            await this.downloadMakeFile();
            this.prepBuildCommands();
            await this.prepNextGenBuild();
            return await this.executeBuild();
    }

    @throwIfJobInterupted()
    protected async deployGeneric(): Promise<CommandExecutorResponse> {
        this.prepDeployCommands();
        this._logger.save(this.currJob._id, `${'(stage)'.padEnd(15)}Pushing to ${this.name}`);
        
        if (this.currJob.deployCommands && new TestableArrayWrapper().length(this.currJob.deployCommands) > 0 ) {
            const resp = await this._commandExecutor.execute(this.currJob.deployCommands)
            if (resp && resp.error && resp.error.indexOf('ERROR') !== -1) {
                this._logger.save(this.currJob._id, `${'(stage)'.padEnd(15)}Failed to push to ${this.name}`);
                throw new PublishError(`Failed pushing to ${this.name}: ${resp.error}`)
              }
            this._logger.save(this.currJob._id,`${'(stage)'.padEnd(15)}Finished pushing to ${this.name}`);
            this._logger.save(this.currJob._id,`${'(stage)'.padEnd(15)}Staging push details:\n\n${resp.output}`);
            return resp;

        } else {
            this._logger.save(this.currJob._id, `${'(stage)'.padEnd(15)}Pushing to ${this.name} failed as there is no commands to execute`);
            throw new PublishError(`Failed pushing to ${this.name}, No commands to execute`);
        }
    }

    @throwIfJobInterupted()
    public async execute(): Promise<void> {
        this._logger.save(this._currJob._id, `* Starting Job with ID: ${this._currJob._id} and type: ${this._currJob.payload.jobType}`);
        try {
            await this.build();
            const resp = await this.deploy();
            await this.update(resp);
            this.cleanup();
        } catch (error) {
            try {
                await this._jobRepository.updateWithErrorStatus(this._currJob._id, error.message)
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
                let jobHandler = this as JobHandler;
                if (jobHandler && jobHandler.isStopped() && !jobHandler.stopped) {
                    jobHandler.getLogger().info(descriptor.value, `Resetting Job with ID: ${jobHandler.currJob._id} because server is being shut down`);
                    jobHandler.jobRepository.resetJobStatus(jobHandler.currJob._id, `Resetting Job with ID: ${jobHandler.currJob._id} because server is being shut down`);
                    jobHandler.stopped = true;
                    throw new JobStoppedError(`${jobHandler.currJob._id} is stopped`);
                }
                return original.apply(this, args);
            }
        }
        return descriptor;
    };
}