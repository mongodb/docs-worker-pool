const request = require('request');
const utils = require('../utils/utils');
const environment = require('../utils/environment').EnvironmentClass;
const fastly = require('fastly')(environment.getFastlyToken());
const https = require('https')
const fastly_service_id = environment.getFastlyServiceId();
const headers = {
  'Fastly-Key': environment.getFastlyToken(),
  'Accept': 'application/json',
  'Content-Type': 'application/json', 
  'Fastly-Debug': 1
};


class FastlyJobClass {
  // pass in a job payload to setup class
  constructor(currentJob) {
    this.currentJob = currentJob;
    if (fastly === undefined) {
      utils.logInMongo(currentJob, 'fastly connectivity not found');
    }
  }

  // request urls of updated content to "warm" the cache for our customers
warmCache(updatedUrl) {
    try {
      return new Promise(function (resolve) {
        request.get(updatedUrl, function (err, response) {
          if (!err && response.statusCode === 200) {
            resolve(response.statusCode)
          }
      })
    })
    } catch (error) {
      console.trace(error)
      throw error
    }
  }
  // takes in an array of surrogate keys and purges cache for each
  async purgeCache(urlArray) {
    if (!Array.isArray(urlArray)) {
      throw new Error('Parameter `urlArray` needs to be an array of urls');
    }

    let that = this;
    let urlCounter = urlArray.length;
    let purgeMessages = [];
    const fastly_service_id = environment.getFastlyServiceId();
  
      for (let i = 0; i < urlArray.length; i++) {
        //retrieve surrogate key
        try {
          const surrogateKey = await this.retrieveSurrogateKey(urlArray[i])
          // perform request to purge
          await this.requestPurgeOfSurrogateKey(surrogateKey)

          //warm cache 
          await this.warmCache(urlArray[i])
        } catch (error) {
          console.trace(error)
          //should return reject here?
          throw error
        }
    }
    return new Promise((resolve) => {
      resolve(true);
    });
    //what should be condition for rejecting?? 
}

  retrieveSurrogateKey(url) {
  try {
    return new Promise(function (resolve) {
      request({
        method: `HEAD`,
        url: url,
        headers: headers,
     }, function(err, response, body) {
          if (!err && response.statusCode == 200) {
            resolve(response.headers['surrogate-key']); 
          }
        })
      })
  
  } catch (error) {
    console.trace(error)
    throw error
  }

}

  requestPurgeOfSurrogateKey(surrogateKey){
    try {
      return new Promise(function (resolve) {
        headers['Surrogate-Key'] = surrogateKey
        request({
          method: `POST`,
          url: `https://api.fastly.com/service/${fastly_service_id}/purge/${surrogateKey}`,
          path: `/service/${fastly_service_id}/purge${surrogateKey}`,
          headers: headers,
      }, function(err, response, body) {
          if (!err && response.statusCode == 200){
            resolve(response.statusCode)
          }
          //else what to do if there is err?
        }
        )
      })    
    } catch (error) {
      console.trace(error)
      throw error
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
