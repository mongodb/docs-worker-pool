import { IJob } from '../entities/job';
import { CommandExecutorResponse, IGithubCommandExecutor } from './commandExecutor';
import { IJobRepoLogger } from './logger';
import { IConfig } from "config";
import { InvalidJobError } from '../errors/errors';
import simpleGit from 'simple-git';
import { IFileSystemServices } from './fileServices';
export interface IRepoConnector {
    applyPatch(job: IJob): Promise<any>
    cloneRepo(job: IJob): Promise<any>
    checkCommits(job: IJob): Promise<CommandExecutorResponse>
    pullRepo(job: IJob): Promise<CommandExecutorResponse>
}

export class GitHubConnector implements IRepoConnector {
    _commandExecutor: IGithubCommandExecutor;
    _jobRepoLogger: IJobRepoLogger;
    _config: IConfig
    _fileSystemService: IFileSystemServices;

    constructor(commandExecutor: IGithubCommandExecutor, config: IConfig, fileSystemService: IFileSystemServices, logger: IJobRepoLogger) {
        this._commandExecutor = commandExecutor;
        this._jobRepoLogger = logger;
        this._config = config;
        this._fileSystemService = fileSystemService;
    }

    private getBasePath(job: IJob): string {
        let botName = this._config.get("GITHUB_BOT_USERNAME");
        let botPw = this._config.get("GITHUB_BOT_PASSWORD");
        return (job.payload.private) ? `https://${botName}:${botPw}@github.com` : "https://github.com";
    }

    async applyPatch(job: IJob): Promise<any> {

        if (job.payload.patch) {
            try {
                this._fileSystemService.writeToFile(`repos/${job.payload.repoName}/myPatch.patch`, job.payload.patch, { encoding: 'utf8', flag: 'w' });
                return await this._commandExecutor.applyPatch(job.payload.repoName, "myPatch.patch");
            } catch (error) {
                console.log()
                this._jobRepoLogger.save(job._id, `Error creating patch  ${error}`);
                throw new InvalidJobError(`Error creating patch  ${error}`);
            }
        }
    }

    async cloneRepo(job: IJob): Promise<any> {
        this._jobRepoLogger.save(job._id, `${'(GIT)'.padEnd(15)}Cloning repository`);
        this._jobRepoLogger.save(job._id, `${'(GIT)'.padEnd(15)}running fetch`);
        try {
            const basePath = this.getBasePath(job);
            const repoPath = basePath + '/' + job.payload.repoOwner + '/' + job.payload.repoName;
            let resp = await simpleGit('repos').clone(repoPath, `${job.payload.repoName}`);
            this._jobRepoLogger.save(job._id, `${'(GIT)'.padEnd(15)}Finished git clone`);
            return resp;
        } catch (errResult) {
            this._jobRepoLogger.save(job._id, `${'(GIT)'.padEnd(15)}stdErr: ${errResult.stderr}`);
            throw errResult;
        }
    }

    async checkCommits(job: IJob): Promise<any> {
        if ( job.payload.newHead ) {
            return await this._commandExecutor.checkoutBranchForSpecificHead(job.payload.repoName, job.payload.branchName, job.payload.newHead);
        }
    }

    async pullRepo(job: IJob): Promise<any> {
        
        return await this._commandExecutor.pullRepo(job.payload.repoName, job.payload.branchName, job.payload.newHead)
    }

}