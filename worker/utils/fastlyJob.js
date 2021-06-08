const axios = require('axios').default;
const environment = require('../utils/environment').EnvironmentClass;
const fastly = require('fastly')(environment.getFastlyToken());
const utils = require('../utils/utils');
const Logger = require('../utils/logger').LoggerClass;

const fastlyServiceId = environment.getFastlyServiceId();
const headers = {
    'Fastly-Key': environment.getFastlyToken(),
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Fastly-Debug': 1,
};


class FastlyJobClass {
    // pass in a job payload to setup class
    constructor(currentJob) {
        this.currentJob = currentJob;
        this.logger = new Logger(currentJob);
        if (fastly === undefined) {
            utils.logInMongo(currentJob, 'fastly connectivity not found');
        }
    }

    // takes in an array of surrogate keys and purges cache for each
    async purgeCache(urlArray) {
        if (!Array.isArray(urlArray)) {
            throw new Error('Parameter `urlArray` needs to be an array of urls');
        }

        try {
            //retrieve surrogate key associated with each URL/file updated in push to S3
            const surrogateKeyPromises = urlArray.map(url => this.retrieveSurrogateKey(url));
            const surrogateKeyArray = await Promise.all(surrogateKeyPromises)

            //purge each surrogate key
            const purgeRequestPromises = surrogateKeyArray.map(surrogateKey => this.requestPurgeOfSurrogateKey(surrogateKey));
            await Promise.all(purgeRequestPromises);

            // GET request the URLs to warm cache for our users
            const warmCachePromises = urlArray.map(url => this.warmCache(url));
            await Promise.all(warmCachePromises)
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}error in purge cache: ${error}`);
            // throw error
        }

    }

    async retrieveSurrogateKey(url) {

        try {
            return axios({
                method: 'HEAD',
                url: url,
                headers: headers,
            }).then(response => {
                if (response.status === 200) {
                    return response.headers['surrogate-key'];
                }
            });
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}error in retrieveSurrogateKey: ${error}`);
            throw error
        }

    }

    async requestPurgeOfSurrogateKey(surrogateKey) {
        headers['Surrogate-Key'] = surrogateKey

        try {
            return axios({
                    method: `POST`,
                    url: `https://api.fastly.com/service/${fastlyServiceId}/purge/${surrogateKey}`,
                    path: `/service/${fastlyServiceId}/purge${surrogateKey}`,
                    headers: headers,
                })
                .then(response => {
                    if (response.status === 200) {
                        return true
                    }
                });
        } catch (error) {
            this.logger.save(`${'(prod)'.padEnd(15)}error in requestPurgeOfSurrogateKey: ${error}`);
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
    async connectAndUpsert(map) {
        const options = {
            item_value: map.target,
        };
        const connectString = `/service/${fastlyServiceId}/dictionary/${environment.getDochubMap()}/item/${
          map.source
          }`;

        return new Promise((resolve, reject) => {
            fastly.request('PUT', connectString, options, (err, obj) => {
                if (err) reject(err);
                resolve(obj);
            });
        })
    }
}

module.exports = {
    FastlyJobClass,
};