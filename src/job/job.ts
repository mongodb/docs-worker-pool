import { ICDNConnector } from "../services/cdn";
import { ICommandExecutor } from "../services/commandExecutor";
import { IDBConnector } from "../services/db";
import { ILogger } from "../services/logger";
import { IRepoConnector } from "../services/repo";

 export interface IJob {
    readonly jobType: string;
    readonly source: string;
    readonly action: string;
    readonly repoName: string;
    readonly branchName: string;
    readonly isFork: boolean;
    readonly private: boolean;
    readonly repoOwner: string;
    readonly url:string;
    readonly parentHash: string;
    readonly newHead: string;
    manifestPrefix: string;
    pathPrefix: string;
    mutPrefix: string;
    buildCommands: Array<string>;
    publishCommands: Array<string>;
    updateStatus(newStatus: string): Promise<boolean>;
}

class Job implements IJob {
    private _jobType: string;
    public get jobType(): string {
        return this._jobType;
    }
    
    private _source: string;
    public get source(): string {
        return this._source;
    }

    private _action: string;
    public get action(): string {
        return this._action;
    }
    
    private _repoName: string;
    public get repoName(): string {
        return this._repoName;
    }
    
    private _branchName: string;
    public get branchName(): string {
        return this._branchName;
    }
    
    private _isFork: boolean;
    public get isFork(): boolean {
        return this._isFork;
    }
    
    private _private: boolean;
    public get private(): boolean {
        return this._private;
    }
    
    private _repoOwner: string;
    public get repoOwner(): string {
        return this._repoOwner;
    }
    
    private _url: string;
    public get url(): string {
        return this._url;
    }
    
    private _parentHash: string;
    public get parentHash(): string {
        return this._parentHash;
    }
    
    private _newHead: string;
    public get newHead(): string {
        return this._newHead;
    }
    
    private _manifestPrefix: string;
    public get manifestPrefix(): string {
        return this._manifestPrefix;
    }
    public set manifestPrefix(value: string) {
        this._manifestPrefix = value;
    }
    
    private _pathPrefix: string;
    public get pathPrefix(): string {
        return this._pathPrefix;
    }
    public set pathPrefix(value: string) {
        this._pathPrefix = value;
    }
    
    private _mutPrefix: string;
    public get mutPrefix(): string {
        return this._mutPrefix;
    }
    public set mutPrefix(value: string) {
        this._mutPrefix = value;
    }
    
    private _buildCommands: string[];
    public get buildCommands(): string[] {
        return this._buildCommands;
    }
    public set buildCommands(value: string[]) {
        this._buildCommands = value;
    }
    
    private _publishCommands: string[];
    public get publishCommands(): string[] {
        return this._publishCommands;
    }
    public set publishCommands(value: string[]) {
        this._publishCommands = value;
    }

    private dbConnector: IDBConnector;

    async updateStatus(newStatus: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    constructor (rawJob: any, dbConnector: IDBConnector) {
        this.dbConnector = dbConnector;
        for ( let k in rawJob) {
            this['_'+k] = rawJob[k]
        }
    }

}

export abstract class JobHandler {
    protected _currJob: IJob;
    protected _commandExecutor: ICommandExecutor;
    protected _dbConnector: IDBConnector;
    protected _cdnConnector: ICDNConnector;
    protected _repoConnector: IRepoConnector;
    protected _logger: ILogger;
    
    /**
     * ICommandExecutor
     * IDBConnector
     * ICDNConnector
     * IRepoConnector
     * ILogger
     * 
     */
    constructor (job: IJob, commandExecutor: ICommandExecutor, dbConnector: IDBConnector, cdnConnector:ICDNConnector, repoConnector:IRepoConnector, logger: ILogger) {
        this._commandExecutor = commandExecutor;
        this._dbConnector = dbConnector;
        this._cdnConnector = cdnConnector;
        this._repoConnector = repoConnector;
        this._logger = logger;
        this._currJob = job
    }

    abstract prepCommands():  Promise<string[]>;

    async execute(): Promise<void> {
        await this.prepCommands()
        await this.build()
        await this.publish()
        await this.update()
    }

    async build(): Promise<void> {
        /**
         * Clone the repo
         * Pull the repo
         */
    }

    abstract publish(): Promise<void>;
    async update(): Promise<void> {
    }

}