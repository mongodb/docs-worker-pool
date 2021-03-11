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
  async purgeCache(urlArray) {
    console.log("purge cache is called!!!!")
    if (!Array.isArray(urlArray)) {
      throw new Error('Parameter `urlArray` needs to be an array of urls');
    }

    let that = this;
    let urlCounter = urlArray.length;
    let purgeMessages = [];
    const fastly_service_id = environment.getFastlyServiceId();
    const options = {
      method:'POST',
      port: 80,
      host: 'docs-mongodbcom-integration.corp.mongodb.com',
      headers : {
        'Fastly-Key': environment.getFastlyToken(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Host': 'www.docs-mongodbcom-integration.corp.mongodb.com'
      }
    }
    // const headers = {
    //   'Fastly-Key': environment.getFastlyToken(),
    //   'Accept': 'application/json',
    //   'Content-Type': 'application/json'
    // };

    return new Promise((resolve, reject) => {
      
      
      
      
      for (let i = 0; i < urlArray.length; i++) {
        // perform request to purge
        console.log(urlArray[i])
        // console.log(`service/${fastly_service_id}/purge/${urlArray[i]}`)
        
        options['path'] = `/service/${fastly_service_id}/purge`
        options['service-id'] = fastly_service_id
        options['Surrogate-Key'] = urlArray[i]
        const req = https.request(options, res => {
          console.log(`statusCode: ${res.statusCode}`)
        
          res.on('data', d => {
            process.stdout.write(d)
          })
        })
        
        req.on('error', error => {
          console.error(error)
        })
        
        req.write(data)
        req.end()


        // request({
        //    method: `POST`,
        //   //  method: 'PURGE',
        //    path: `/service/${fastly_service_id}/purge${urlArray[i]}`,
        //    headers: headers,
        // }, function(err, response, body) {
        //   // url was not valid to purge
        //   if (err){
        //     console.log("is there an err???")
        //     console.log(err)
        //   }
        //   console.log(response)
          
        //   console.log("\n")
        //   // console.log(JSON.parse(body))
        //   console.log(body)
        //   if (!response) {
        //     console.log("this is an error in the response!!!")
        //     utils.logInMongo(that.currentJob, `Error: service for this url does not exist in fastly for purging ${urlArray[i]}`);
        //     purgeMessages.push({
        //       'status': 'failure',
        //       'message': `service with url ${urlArray[i]} does not exist in fastly`
        //     });
        //   } else if (response.headers['content-type'].indexOf('application/json') === 0) {
        //     try {
        //       body = JSON.parse(body);
        //       purgeMessages.push(body);
        //     } catch(er) {
        //       console.log("hey!!!")
        //       utils.logInMongo(that.currentJob, `Error: failed parsing output from fastly for url ${urlArray[i]}`);
        //       console.log(`Error: failed parsing output from fastly for url ${urlArray[i]}`);
        //     }
        //   }
        //   // when we are done purging all urls
        //   // this is outside of the conditional above because if some url fails to purge
        //   // we do not want to actually have this entire build fail, just show warning
        //   urlCounter--;
        //   if (urlCounter <= 0) {
        //     resolve({
        //       'status': 'success',
        //       'fastlyMessages': purgeMessages,
        //     });
        //   }
        // });
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
