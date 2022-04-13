import { IJob } from '../entities/job';
import { CommandExecutorResponse, IGithubCommandExecutor } from './commandExecutor';
import { IJobRepoLogger } from './logger';
import { IConfig } from 'config';
import { InvalidJobError } from '../errors/errors';
import { IFileSystemServices } from './fileServices';
import simpleGit, { SimpleGit } from 'simple-git';
const git: SimpleGit = simpleGit();

export interface IRepoConnector {
  applyPatch(job: IJob): Promise<any>;
  cloneRepo(job: IJob, targetPath: string): Promise<any>;
  checkCommits(job: IJob): Promise<CommandExecutorResponse>;
  pullRepo(job: IJob): Promise<CommandExecutorResponse>;
}

export class GitHubConnector implements IRepoConnector {
  _commandExecutor: IGithubCommandExecutor;
  _jobRepoLogger: IJobRepoLogger;
  _config: IConfig;
  _fileSystemService: IFileSystemServices;

  constructor(
    commandExecutor: IGithubCommandExecutor,
    config: IConfig,
    fileSystemService: IFileSystemServices,
    logger: IJobRepoLogger
  ) {
    this._commandExecutor = commandExecutor;
    this._jobRepoLogger = logger;
    this._config = config;
    this._fileSystemService = fileSystemService;
  }

  private getBasePath(job: IJob): string {
    const botName = this._config.get<string>('githubBotUserName');
    const botPw = this._config.get<string>('githubBotPW');
    return job.payload.private ? `https://${botName}:${botPw}@github.com` : 'https://github.com';
  }

  async applyPatch(job: IJob): Promise<any> {
    if (job.payload.patch) {
      try {
        this._fileSystemService.writeToFile(`repos/${job.payload.repoName}/myPatch.patch`, job.payload.patch, {
          encoding: 'utf8',
          flag: 'w',
        });
        return await this._commandExecutor.applyPatch(job.payload.repoName, 'myPatch.patch');
      } catch (error) {
        await this._jobRepoLogger.save(job._id, `Error creating patch  ${error}`);
        throw new InvalidJobError(`Error creating patch  ${error}`);
      }
    }
  }

  async cloneRepo(job: IJob, targetPath: string): Promise<any> {
    try {
      await git.clone(
        this.getBasePath(job) + '/' + job.payload.repoOwner + '/' + job.payload.repoName,
        `${targetPath}/${job.payload.repoName}`
      );
      await this._jobRepoLogger.save(job._id, `${'(GIT)'.padEnd(15)}Finished git clone`);
    } catch (errResult) {
      await this._jobRepoLogger.save(job._id, `${'(GIT)'.padEnd(15)}stdErr: ${errResult.stderr}`);
      throw errResult;
    }
  }

  async checkCommits(job: IJob): Promise<any> {
    if (job.payload.newHead) {
      return await this._commandExecutor.checkoutBranchForSpecificHead(
        job.payload.repoName,
        job.payload.branchName,
        job.payload.newHead
      );
    }
  }

  async pullRepo(job: IJob): Promise<any> {
    return await this._commandExecutor.pullRepo(job.payload.repoName, job.payload.branchName, job.payload.newHead);
  }
}
