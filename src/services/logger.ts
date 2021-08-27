import { Logger } from "tslog";
import {IDBConnector} from "./db"

export interface ILogger {
    info(contextId:string, message: string): Promise<void>;
    warn(contextId:string, message: string): Promise<void>;
    error(contextId:string, message: string): Promise<void>;
    save(contextId:string, message: string): Promise<void>;
}

export class HybridLogger implements ILogger {
    constructor(dbConnector: IDBConnector) {
        if (dbConnector) {
            this._dbConnector = dbConnector;
        }
    }
    info(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    warn(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    error(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    save(contextId: string, message: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    private _dbConnector: IDBConnector;

}