const axios = require('axios').default;
const environment = require('../utils/environment').EnvironmentClass;
const fastly = require('fastly');
const utils = require('../utils/utils');
const Logger = require('../utils/logger').LoggerClass;

class FastlyJobClass {
    // pass in a job payload to setup class
    constructor(currentJob) {
        this.currentJob = currentJob;
        this.logger = new Logger(currentJob);
        if (fastly === undefined) {
            utils.logInMongo(currentJob, 'fastly connectivity not found');
        }
    }

    getHeaders(token) {
        return  {
            'Accept': 'application/json',
            'Fastly-Key': token,
            'Content-Type': 'application/json',
            'Fastly-Debug': 1,
        }
    }

    // takes in an array of surrogate keys and purges cache for each
    async purgeCache(urlArray, logger, purgeAll = false) {
        const token = environment.getFastlyToken(this.currentJob.currentJob.payload.repoName);
        const serviceId = environment.getFastlyServiceId(this.currentJob.currentJob.payload.repoName);
        if (!Array.isArray(urlArray)) {
            console.log(`ERROR urlArray ${this.currentJob.currentJob._id}`)
            throw new Error('Parameter `urlArray` needs to be an array of urls');
        }
         if (!purgeAll) {
            try {
                logger.save(`Purging URL's`);
                //retrieve surrogate key associated with each URL/file updated in push to S3
                const surrogateKeyPromises = urlArray.map(url => this.retrieveSurrogateKey(url, token));
                const surrogateKeyArray = await Promise.all(surrogateKeyPromises)
                console.log(`Surrogate keys: ${JSON.stringify(surrogateKeyArray)} JobID: ${this.currentJob.currentJob._id}`);
                //purge each surrogate key
                const purgeRequestPromises = surrogateKeyArray.map(surrogateKey => this.requestPurgeOfSurrogateKey(surrogateKey, serviceId, token));
                await Promise.all(purgeRequestPromises);
                // GET request the URLs to warm cache for our users
                const warmCachePromises = urlArray.map(url => this.warmCache(url));
                await Promise.all(warmCachePromises)
            } catch (error) {
                logger.save(`${'(prod)'.padEnd(15)}error in purge urls: ${error}`);
            }

        } else {
            try {
                logger.save(`Purging all`);
                await this.requestPurgeAll(serviceId, token)
            } catch (error) {
                logger.save(`${'(prod)'.padEnd(15)}error in purge all: ${error}`);
            }
        }
    }


    async retrieveSurrogateKey(url, token) {
        try {
            console.log(`retrieveSurrogateKey URL: ${url} headers: ${JSON.parse(this.getHeaders(token))}`);
            return axios({
                method: 'HEAD',
                url: url,
                headers: this.getHeaders(token),
            }).then(response => {
                if (response.status === 200) {
                    console.log(`retrieveSurrogateKey URL: ${url}  success key: ${response.headers['surrogate-key']}`);
                    return response.headers['surrogate-key'];
                }
            });
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}error in retrieveSurrogateKey: ${error}`);
            console.log(`retrieveSurrogateKey URL Failed: ${url}`);
            throw error
        }

    }

    async requestPurgeOfSurrogateKey(surrogateKey, fastlyServiceId, token) {
        let headers = this.getHeaders(token);
        headers['Surrogate-Key'] = surrogateKey;

        try {
            return axios({
                method: `POST`,
                url: `https://api.fastly.com/service/${fastlyServiceId}/purge/${surrogateKey}`,
                path: `/service/${fastlyServiceId}/purge${surrogateKey}`,
                headers: headers,
            })
                .then(response => {
                    if (response.status === 200) {
                        console.log(`requestPurgeOfSurrogateKey: Purge succeeded for ${surrogateKey}`);
                        return true
                    }
                });
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}error in requestPurgeOfSurrogateKey: ${error}`);
            console.log(`requestPurgeOfSurrogateKey: Purge failed for ${surrogateKey}`);
            throw error;
        }
    }

    async requestPurgeAll(fastlyServiceId, token) {
        try {
            return axios({
                method: `POST`,
                url: `https://api.fastly.com/service/${fastlyServiceId}/purge_all`,
                path: `/service/${fastlyServiceId}/purge_all`,
                headers: this.getHeaders(token),
            })
                .then(response => {
                    if (response.status === 200) {
                        return true
                    }
                });
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}error in requestPurgeAll: ${error}`);
            throw error;
        }
    }

    // request urls of updated content to "warm" the cache for our customers
    async warmCache(updatedUrl) {
        try {
            return axios.get(updatedUrl)
                .then(response => {
                    if (response.status === 200) {
                        return true;
                    }
                })
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}stdErr: ${error}`);
            throw error;
        }
    }

    // upserts {source: target} mappings
    // to the fastly edge dictionary
    async connectAndUpsert(map, serviceId, token) {
        const options = {
            item_value: map.target,
        };
        const fastlyObj = fastly(token);
        const connectString = `/service/${serviceId}/dictionary/${environment.getDochubMap()}/item/${map.source}`;
        return new Promise((resolve, reject) => {
            fastlyObj.request('PUT', connectString, options, (err, obj) => {
                if (err) reject(err);
                resolve(obj);
            });
        })
    }
}

module.exports = {
    FastlyJobClass,
};