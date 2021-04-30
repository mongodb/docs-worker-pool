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
  async warmCache(updatedContentURLS) {
    console.log("warm cache called")
    // if (!Array.isArray(updatedContentURLS)) {
    //   throw new Error('Parameter `updatedContentURLS` needs to be an array of urls');
    // }

    
    // for (let i = 0; i < updatedContentURLS.length; i++) {
    //   request(updatedContentURLS[i], function (error, response, body) {
    //     if (!error && response.statusCode == 200) {
    //       console.log(body);
    //     }
    //   })
    // }
  }
  // takes in an array of surrogate keys and purges cache for each
  async purgeCache(urlArray) {


    if (!Array.isArray(surrogateKeyArray)) {
      throw new Error('Parameter `surrogateKeyArray` needs to be an array of urls');
    }

    let that = this;
    let urlCounter = surrogateKeyArray.length;
    let purgeMessages = [];

    return new Promise((resolve, reject) => {
      

      for (let i = 0; i < urlArray.length; i++) {
        //retrieve surrogate key
        const surrogateKey = this.retrieveSurrogateKey(urlArray[i])
        
        // perform request to purge
        this.requestPurgeOfSurrogateKey(surrogateKey)

    }
  })
}

async retrieveSurrogateKey(url) {
  try {
    request({
      method: `GET`,
      url: url,
      headers: headers,
   }, function(err, response, body) {
     // surrogate key was not valid to purge
     if (err){
       console.trace(err)
     }
     console.log(request.headers)
 /*  capture the purge request id in case we still see stale content on site, 
     contact Fastly for further assistance with purge id and resource 
     see https://docs.fastly.com/en/guides/single-purges */
     console.log(body)

 })
  } catch (error) {
    
  }
}

  async requestPurgeOfSurrogateKey(surrogateKey){
    console.log("this is the surrogate key")
    try {
      headers['Surrogate-Key'] = surrogateKey
      request({
        method: `POST`,
        url: `https://api.fastly.com/service/${fastly_service_id}/purge${surrogateKeyArray}`,
        path: `/service/${fastly_service_id}/purge${surrogateKeyArray}`,
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
          }
      )
    } catch (error) {
      console.log(error)
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
