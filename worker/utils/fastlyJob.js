const utils = require('../utils/utils');
const environment = require('../utils/environment').EnvironmentClass;

const fastly = require('fastly')(environment.getFastlyToken());

class FastlyJobClass {
  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
    if (fastly == undefined) {
      utils.logInMongo(currentJob, 'fastly connectivity not found');
    }
  }

  // upserts {source: target} mappings
  // to the fastly edge dictionary
  async connectAndUpsert(map) {
    for (let doc in map) {
      console.log(`iterating ${map[doc].url}`);
      const options = {
        item_value: map[doc].url
      };
      await this.runFastlyMapCall(map[doc], options)
        .catch(err => {
          return err;
        })
        .then();
    }
  }

  async runFastlyMapCall(doc, options) {
    const connectString = `/service/${environment.getFastlyServiceId()}/dictionary/${environment.getDochubMap()}/item/${
      doc.name
    }`;

    let promise1 = (method, url, options) => {
      return new Promise((resolve, reject) => {
        fastly.request(method, url, options, function(err, obj) {
          if (err) return reject(err);
          resolve(obj);
        });
      });
    };

    promise1('POST', connectString, options)
      .then()
      .catch(error => {
        throw error;
      });
  }
}

module.exports = {
  FastlyJobClass: FastlyJobClass
};
