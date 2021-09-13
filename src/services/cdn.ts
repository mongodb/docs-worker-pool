import {IConfig} from "config";
import axios from 'axios';
import { IJobRepoLogger } from "./logger";
import { PurgeBySurrogateKeyFailed, SurrogateKeyNotFound } from "../errors/errors";

export const axiosApi = axios.create();


export interface ICDNConnector {
    purge(jobId:String, urls:Array<string>) : Promise<void>;
    purgeAll(jobId:String): Promise<any>;
    warm(jobId:string, url:string): Promise<any>;
}

export class FastlyConnector implements ICDNConnector {
    private _config: IConfig;
    private  _headers: any;
    private _logger: IJobRepoLogger
    constructor(config: IConfig, logger:IJobRepoLogger) {
        this._config = config;
        this._logger = logger;
        this
        this._headers = {
            'Fastly-Key': this._config.get('fastlyToken'),
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Fastly-Debug': 1,
        };
    }

    async purgeAll(jobId: string): Promise<any> {
        try {
            return await axiosApi.post(`https://api.fastly.com/service/${this._config.get('fastlyServiceId')}/purge_all`, {}, {headers:this._headers});
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in requestPurgeAll: ${error}`);
            throw error;
        }
    }

    async warm(jobId:string, url:string): Promise<any> {
        try {
            const resp = await axiosApi.get(url);
            return resp && resp.status === 200 ? true: false;
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}stdErr: ${error}`);
            throw error;
        }
    }
    

    async purge(jobId:string, urls: Array<string>): Promise<void> {
            try {
                this._logger.save(jobId, `Purging URL's`);
                //retrieve surrogate key associated with each URL/file updated in push to S3
                const surrogateKeyPromises = urls.map(url => this.retrieveSurrogateKey(jobId, url));
                const results = await Promise.all(surrogateKeyPromises.map(p => p.catch((e) => { urls.splice(urls.indexOf(e.url),1); return ""; })));  
                const surrogateKeyArray = results.filter(result => result);
                const purgeRequestPromises = surrogateKeyArray.map(surrogateKey => this.requestPurgeOfSurrogateKey(jobId, surrogateKey));
                await Promise.all(purgeRequestPromises.map(p => p.catch((e) => { urls.splice(urls.indexOf(e.url),1); return ""; })));  
                    // GET request the URLs to warm cache for our users
                const warmCachePromises = urls.map(url => this.warm(jobId, url));
                await Promise.all(warmCachePromises)
            } catch (error) {
                this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in purge urls: ${error}`);
            }

    }

    private async requestPurgeOfSurrogateKey(jobId:string, surrogateKey:string, relevantUrl:string = ""): Promise<boolean|undefined>  {
        this._headers['Surrogate-Key'] = surrogateKey

        try {
            return await axiosApi.post(`https://api.fastly.com/service/${this._config.get('fastlyServiceId')}/purge/${surrogateKey}`, {}, {headers:this._headers});
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in requestPurgeOfSurrogateKey for Key:${surrogateKey} Url:${relevantUrl} Error:${error}`);
            throw new PurgeBySurrogateKeyFailed(error, relevantUrl)
        }
    }

    private async retrieveSurrogateKey(jobId:string, url:string) :Promise<string> {

        try {
            const resp = await axiosApi.head(url, {headers:this._headers});
            return resp.headers['surrogate-key'];
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in retrieveSurrogateKey for url ${url} Error:${error}`);
            throw new SurrogateKeyNotFound(error, url)
        }
    }
}