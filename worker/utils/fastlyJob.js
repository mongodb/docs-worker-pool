const request = require('request');
const environment = require('../utils/environment').EnvironmentClass;
const fastly = require('fastly')(environment.getFastlyToken());
const utils = require('../utils/utils');

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
        if (fastly === undefined) {
          utils.logInMongo(currentJob, 'fastly connectivity not found');
        }
    }

    // takes in an array of surrogate keys and purges cache for each
    async purgeCache(urlArray) {
        if (!Array.isArray(urlArray)) {
            throw new Error('Parameter `urlArray` needs to be an array of urls');
        }

        for (let i = 0; i < urlArray.length; i++) {
              // retrieve surrogate key
              try {
                  const surrogateKey = await this.retrieveSurrogateKey(urlArray[i]);
                  // perform request to purge
                  await this.requestPurgeOfSurrogateKey(surrogateKey);

                  // warm cache
                  await this.warmCache(urlArray[i]);
              } catch (error) {
                  console.trace(error);
                  // should return reject here?
                  throw error;
              }
          }
        return new Promise((resolve) => {
          resolve(true);
        });
        // what should be condition for rejecting??
    }

    retrieveSurrogateKey(url) {
        try {
            return new Promise((resolve) => {
              request({
                method: 'HEAD',
                url: url,
                headers: headers,
            }, (err, response) => {
                  if (!err && response.statusCode === 200) {
                    resolve(response.headers['surrogate-key']); 
                  }
                });
            });
        } catch (error) {
            console.trace(error);
            throw error;
        }
    }

    requestPurgeOfSurrogateKey(surrogateKey){
        try {
          return new Promise((resolve) => {
            headers['Surrogate-Key'] = surrogateKey
            request({
              method: `POST`,
              url: `https://api.fastly.com/service/${fastlyServiceId}/purge/${surrogateKey}`,
              path: `/service/${fastlyServiceId}/purge${surrogateKey}`,
              headers: headers,
          }, (err, response) => {
              if (!err && response.statusCode === 200){
                resolve(response.statusCode);
              }
            });
          });
        } catch (error) {
          console.trace(error);
          throw error;
        }
      }

    // request urls of updated content to "warm" the cache for our customers
    warmCache(updatedUrl) {
        try {
          return new Promise((resolve) => {
            request.get(updatedUrl, (err, response) => {
              if (!err && response.statusCode === 200) {
                resolve(response.statusCode);
              }
          });
        });
        } catch (error) {
          console.trace(error);
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
