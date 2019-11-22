const mongo = require('../utils/mongo');

class FastlyJobClass {
    // pass in a job payload to setup class
    constructor(currentJob) {
        this.currentJob = currentJob;
    }

    // connects to dochub database and upsert {source: target} mappings
    // to the fastly edge dictionary
    connectAndUpsert(MongoClient, fastly) {
        MongoClient.connect(mongo.url, function(err, client) {
            assert.equal(null, err);
        
            const db = client.db("dochub");
        
            var cursor = db.collection('keys').find({});
        
            function iterateFunc(doc) {
              const page = "https://dochub.mongodb.org/core/" + doc.name;
              var request = require('request');
              request.get(page, function(err, res, body) {
                if (res != null) {
                  if (res.status != 404) {
                    const options = {
                      item_value: doc.url
                    }
        
                    fastly.request('PUT', '/service/0U4FLNfta0jDgmrSFA193k/dictionary/2FoAatLRziZlxb6aTwnRWs/item/'+doc.name, options, function (err, obj) {
                      if (err) return console.dir(err);
                      console.dir(obj);
                    });
                  } else {
                    console.log("Bad URL: ", page, res.status);
                  }
                }
              });
            }
        
            function errorFunc(error) {
              console.log(error);
            }
        
            cursor.forEach(iterateFunc, errorFunc);
        
        
            client.close();
        });
    }
}

module.exports = {
    FastlyJobClass: FastlyJobClass
};