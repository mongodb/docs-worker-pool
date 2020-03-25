const request = require('request');
const utils = require('../utils/utils');
const environment = require('../utils/environment').EnvironmentClass;
const fastly = require('fastly')(environment.getFastlyToken());


class FastlyJobClass {
  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
    if (fastly === undefined) {
      utils.logInMongo(currentJob, 'fastly connectivity not found');
    }
  }

  // takes in an array of urls and purges cache for each
  async purgeCache(urlArray) {
    if (!Array.isArray(urlArray)) {
      throw new Error('Parameter `urlArray` needs to be an array of urls');
    }

    let urlCounter = urlArray.length;
    let purgeMessages = [];

    const headers = {
      'fastly-key': environment.getFastlyToken(),
      'accept': 'application/json',
      'Fastly-Soft-Purge': '1',
    };

    return new Promise((resolve, reject) => {
      for (let i = 0; i < urlArray.length; i++) {
        // perform request to purge
        request({
          method: 'PURGE',
          url: urlArray[i],
          headers: headers,
        }, function(err, response, body) {
          urlCounter--;
          if (response.headers['content-type'].indexOf('application/json') === 0) {
            try {
              body = JSON.parse(body);
              purgeMessages.push(body);
              // when we are done purging all urls
              if (urlCounter <= 0) {
                resolve({
                  'status': 'success',
                  'fastlyMessages': purgeMessages,
                });
              }
            } catch(er) {
              throw new Error('failed parsing output from fastly');
            }
          }
        });
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
