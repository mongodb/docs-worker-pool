import { IJob } from "../job/job";
import {config} from "config";

export interface ICDNConnector {
    purge(job:IJob): Promise<any>
    warm(job:IJob): Promise<any>
    upsert(job:IJob): Promise<any>
    
}

export class FastlyConnector implements ICDNConnector {
    _config: config;
    constructor(config: config) {
        this._config = config;
    }
    warm(job:IJob): Promise<any> {
        throw new Error("Method not implemented.");
    }
    upsert(job:IJob): Promise<any> {
        throw new Error("Method not implemented.");
    }
    purge(job:IJob): Promise<any> {
        throw new Error("Method not implemented.");
    }

}