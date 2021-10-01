import axios from 'axios';
import { ILogger } from "./logger";

export const axiosApi = axios.create();


export interface ICDNConnector {
    purge(jobId: String, urls: Array<string>): Promise<void>;
    purgeAll(creds: any): Promise<any>;
    warm(jobId: string, url: string): Promise<any>;
    upsertEdgeDictionaryItem(keyValue: any, id: string, creds: any): Promise<void>;
}

export class FastlyConnector implements ICDNConnector {
    private _logger: ILogger
    constructor(logger: ILogger) {
        this._logger = logger;
    }

    getHeaders(creds: any): any {
        return {
            'Fastly-Key': creds["token"],
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Fastly-Debug': 1,
        };
    }

    async purgeAll(creds: any): Promise<any> {
        return await axiosApi.post(`https://api.fastly.com/service/${creds['id']}/purge_all`, {}, { headers: this.getHeaders(creds) });
    }

    async warm(url: string): Promise<any> {
        return await axiosApi.get(url);
    }


    async purge(jobId: string, urls: Array<string>): Promise<void> {
        const purgeUrlPromises = urls.map(url => this.purgeURL(jobId, url));
        await Promise.all(purgeUrlPromises.map(p => p.catch((e) => { urls.splice(urls.indexOf(e.url), 1); return ""; })));
        this._logger.info(jobId, `Total urls purged ${urls.length}`);
        // GET request the URLs to warm cache for our users
        const warmCachePromises = urls.map(url => this.warm(url));
        await Promise.all(warmCachePromises)
    }

    private async purgeURL(jobId: string, url: string): Promise<any> {
        return await axiosApi({
            method: 'PURGE',
            url: url
        });
    }

    async upsertEdgeDictionaryItem(keyValue: any, id: string, creds: any): Promise<any> {
        return await axiosApi.put(`https://api.fastly.com/service/${creds['id']}/dictionary/${id}/item/${keyValue.key}`, {
            item_value: keyValue.value,
        }, { headers: this.getHeaders(creds) });
    }
}