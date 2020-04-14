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

    let that = this;
    let urlCounter = urlArray.length;
    let purgeMessages = [];

    // the 1 is just "some" value needed for this header: https://docs.fastly.com/en/guides/soft-purges
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
          // url was not valid to purge
          if (!response) {
            utils.logInMongo(that.currentJob, `Error: service for this url does not exist in fastly for purging ${urlArray[i]}`);
            purgeMessages.push({
              'status': 'failure',
              'message': `url ${urlArray[i]} does not exist in fastly`
            });
          } else if (response.headers['content-type'].indexOf('application/json') === 0) {
            try {
              body = JSON.parse(body);
              purgeMessages.push(body);
            } catch(er) {
              utils.logInMongo(that.currentJob, `Error: failed parsing output from fastly for url ${urlArray[i]}`);
              console.log(`Error: failed parsing output from fastly for url ${urlArray[i]}`);
            }
          }
          // when we are done purging all urls
          // this is outside of the conditional above because if some url fails to purge
          // we do not want to actually have this entire build fail, just show warning
          urlCounter--;
          if (urlCounter <= 0) {
            resolve({
              'status': 'success',
              'fastlyMessages': purgeMessages,
            });
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
