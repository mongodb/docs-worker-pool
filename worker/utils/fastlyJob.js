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
      fastly.request('PUT', connectString, options, function (err, obj) {
        if (err) reject(err);
        resolve(obj);
      });
    })
  }
}

module.exports = {
  FastlyJobClass: FastlyJobClass
};
