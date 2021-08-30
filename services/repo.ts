import { IJob } from '../entities/job';
import { ICommandExecutor } from './commandExecutor';
import { IJobRepoLogger } from './logger';
export interface IRepoConnector {
    applyPatch(job: IJob): Promise<any>
    cloneRepo(job: IJob): Promise<any>
    checkCommits(job: IJob): Promise<any>
    pullRepo(job:IJob): Promise<any>
}

export class GitHubConnector implements IRepoConnector {
    _commandExectuor: ICommandExecutor;
    _jobRepoLogger: IJobRepoLogger; 


    constructor (commandExecutor: ICommandExecutor, logger: IJobRepoLogger) {
        this._commandExectuor = commandExecutor;
        this._jobRepoLogger = logger;
    }
    applyPatch(job: IJob): Promise<any> {
        throw new Error('Method not implemented.');
    }
    cloneRepo(job: IJob): Promise<any> {
        throw new Error('Method not implemented.');
    }
    checkCommits(job: IJob): Promise<any> {
        throw new Error('Method not implemented.');
    }
    pullRepo(job: IJob): Promise<any> {
        throw new Error('Method not implemented.');
    }

}