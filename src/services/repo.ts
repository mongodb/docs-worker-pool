import {IJob} from '../job/job'
import { ICommandExecutor } from './commandExecutor';
export interface IRepoConnector {
    applyPatch(job: IJob): Promise<any>
    cloneRepo(job: IJob): Promise<any>
    checkCommits(job: IJob): Promise<any>
    pullRepo(job:IJob): Promise<any>
}

export class GitHubConnector implements IRepoConnector {
    _commandExectuor: ICommandExecutor;

    constructor (commandExecutor: ICommandExecutor) {
        this._commandExectuor = commandExecutor;
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