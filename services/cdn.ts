import {IConfig} from "config";
import axios from 'axios';
import { IJobRepoLogger } from "./logger";

export interface ICDNConnector {
    purge(jobId:String, urls:Array<string>) : Promise<any>;
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
            return axios.post(`https://api.fastly.com/service/${this._config.get('fastlyServiceId')}/purge_all`, null, {headers:this._headers});
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in requestPurgeAll: ${error}`);
            throw error;
        }
    }

    async warm(jobId:string, url:string): Promise<any> {
        try {
            return axios.get(url)
                .then(response => {
                    if (response.status === 200) {
                        return true;
                    }
                })
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}stdErr: ${error}`);
            throw error;
        }
    }


    async purge(jobId:string, urls: Array<string>): Promise<any> {
            try {
                this._logger.save(jobId, `Purging URL's`);
                //retrieve surrogate key associated with each URL/file updated in push to S3
                const surrogateKeyPromises = urls.map(url => this.retrieveSurrogateKey(jobId, url));
                const surrogateKeyArray = await Promise.all(surrogateKeyPromises);
                const purgeRequestPromises = surrogateKeyArray.map(surrogateKey => this.requestPurgeOfSurrogateKey(jobId, surrogateKey));
                await Promise.all(purgeRequestPromises);
                    // GET request the URLs to warm cache for our users
                const warmCachePromises = urls.map(url => this.warm(jobId, url));
                await Promise.all(warmCachePromises)
            } catch (error) {
                this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in purge urls: ${error}`);
            }

    }

    private async requestPurgeOfSurrogateKey(jobId:string, surrogateKey:string): Promise<boolean|undefined>  {
        this._headers['Surrogate-Key'] = surrogateKey

        try {
            return await axios.post(`https://api.fastly.com/service/${this._config.get('fastlyServiceId')}/purge/${surrogateKey}`, null, {headers:this._headers});
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in requestPurgeOfSurrogateKey: ${error}`);
            throw error;
        }
    }

    private async retrieveSurrogateKey(jobId:string, url:string) :Promise<string> {

        try {
            return axios({
                method: 'HEAD',
                url: url,
                headers: this._headers,
            }).then(response => {
                if (response.status === 200) {
                    return response.headers['surrogate-key'];
                }
            });
        } catch (error) {
            this._logger.save(jobId, `${'(prod)'.padEnd(15)}error in retrieveSurrogateKey: ${error}`);
            throw error
        }

    }
}