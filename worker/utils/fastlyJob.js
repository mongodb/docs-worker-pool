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
        };
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
                const purgePromises = urlArray.map(url => this.purgeURL(url));
                await Promise.all(purgePromises)
                console.log(`Purging URL purge urls completed Total URL's: ${purgePromises.length}`);
                // GET request the URLs to warm cache for our users
                const warmCachePromises = urlArray.map(url => this.warmCache(url));
                await Promise.all(warmCachePromises)
            } catch (error) {
                logger.save(`${'(prod)'.padEnd(15)}error in purge urls: ${error}`);
                console.log(`Error purge URLs ${error}`);
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

    async purgeURL(url) {
        try {
            return axios({
                method: 'PURGE',
                url: url
            }).then(response => {
                if (response.status === 200) {
                    return;
                } else {
                    console.log(`purgeURL URL: ${url} invaid response ${response}`);
                }
            });
        } catch (error) {
            console.log(`purgeURL Failed: ${url} error: ${error}`);
            this.logger.save(`${'(prod)'.padEnd(15)}error in purgeURL ${url}: ${error}`);
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
            await axios.get(updatedUrl);
        } catch (error) {
            console.log(`Warmcache failed for ${updatedUrl}`);
            this.logger.save(`${'(prod)'.padEnd(15)}stdErr: ${error}`);
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