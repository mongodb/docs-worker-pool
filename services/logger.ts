import {JobRepository} from "../repositories/jobRepository"

export interface ILogger {
    info(contextId:string, message: string): Promise<void>;
    warn(contextId:string, message: string): Promise<void>;
    error(contextId:string, message: string): Promise<void>;
}

export interface IJobRepoLogger extends ILogger {
    save(contextId: string, message: string): Promise<void>;
}

export class ConsoleLogger implements ILogger{
    info(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    warn(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    error(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

export class HybridJobLogger extends ConsoleLogger implements IJobRepoLogger {
    _jobRepo: JobRepository;
    constructor(jobRepo: JobRepository) {
        super();
        this._jobRepo = jobRepo;
    }
    save(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}