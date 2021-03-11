const request = require('request');
const utils = require('../utils/utils');
const environment = require('../utils/environment').EnvironmentClass;
const fastly = require('fastly')(environment.getFastlyToken());
const https = require('https')

class FastlyJobClass {
  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
    if (fastly === undefined) {
      utils.logInMongo(currentJob, 'fastly connectivity not found');
    }
  }

  // takes in an array of urls and purges cache for each
  async purgeCache(surrogateKeyArray) {

    if (!Array.isArray(surrogateKeyArray)) {
      throw new Error('Parameter `surrogateKeyArray` needs to be an array of urls');
    }

    let that = this;
    let urlCounter = surrogateKeyArray.length;
    let purgeMessages = [];
    const fastly_service_id = environment.getFastlyServiceId();

    const headers = {
      'Fastly-Key': environment.getFastlyToken(),
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    return new Promise((resolve, reject) => {
      

      for (let i = 0; i < surrogateKeyArray.length; i++) {
        // perform request to purge
        try {
           headers['Surrogate-Key'] = surrogateKeyArray[i]
           request({
             method: `POST`,
             url: `https://api.fastly.com/service/${fastly_service_id}/purge${surrogateKeyArray[i]}`,
             path: `/service/${fastly_service_id}/purge${surrogateKeyArray[i]}`,
             headers: headers,
          }, function(err, response, body) {
            // surrogate key was not valid to purge
            if (err){
              console.trace(err)
            }
            
        /*  capture the purge request id in case we still see stale content on site, 
            contact Fastly for further assistance with purge id and resource 
            see https://docs.fastly.com/en/guides/single-purges */
            console.log(body)
        })
        } catch (error) {
          console.log(error)
          throw error
        }

    }
  })
}

  // upserts {source: target} mappings
  // to the fastly edge dictionary
  async connectAndUpsert(map) {
    const options = {
      item_value: map.target
    };
    const connectString = `/service/${environment.getFastlyServiceId()}/dictionary/${environment.getDochubMap()}/item/${
      map.source
      }`;

    return new Promise((resolve, reject) => {
      fastly.request('PUT', connectString, options, function(err, obj) {
        if (err) reject(err);
        resolve(obj);
      });
    })
  }
}

module.exports = {
  FastlyJobClass: FastlyJobClass
};
