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


    if (!Array.isArray(urlArray)) {
      throw new Error('Parameter `url array` needs to be an array of urls');
    }

    let that = this;
    let urlCounter = urlArray.length;
    let purgeMessages = [];

    return new Promise((resolve, reject) => {
      

      for (let i = 0; i < urlArray.length; i++) {
        //retrieve surrogate key
        const surrogateKey = this.retrieveSurrogateKey(urlArray[i])
        
        // perform request to purge
        // this.requestPurgeOfSurrogateKey(surrogateKey)

    }
  })
}

async retrieveSurrogateKey(url) {
  try {
    request({
      method: `HEAD`,
      url: 'https://' + url,
      headers: headers,
   }, function(err, response, body) {
     // surrogate key was not valid to purge
     if (err){
       console.trace(err)
       throw err
     }
     console.log("this is the url: ", url)
     console.log("these are the response ", response)
    //  console.log("this is the surrogate key, ", response.headers['surrogate-key'])
 /*  capture the purge request id in case we still see stale content on site, 
     contact Fastly for further assistance with purge id and resource 
     see https://docs.fastly.com/en/guides/single-purges */
 })
  } catch (error) {
    console.trace("error in retrieval: ", error)
    throw error
  }
}

  async requestPurgeOfSurrogateKey(surrogateKey){
    try {
      headers['Surrogate-Key'] = surrogateKey
      request({
        method: `POST`,
        url: `https://api.fastly.com/service/${fastly_service_id}/purge${surrogateKey}`,
        path: `/service/${fastly_service_id}/purge${surrogateKey}`,
        headers: headers,
    }, function(err, response, body) {
      // surrogate key was not valid to purge
      if (err){
        console.trace(err)
      }
      
  /*  capture the purge request id in case we still see stale content on site, 
      contact Fastly for further assistance with purge id and resource 
      see https://docs.fastly.com/en/guides/single-purges */
      // console.log(body)
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
