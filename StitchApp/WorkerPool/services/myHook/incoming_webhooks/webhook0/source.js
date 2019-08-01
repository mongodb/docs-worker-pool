exports = function(payload) {
  console.log("runnning github push webhook");
  const mongodb   = context.services.get("mongodb-atlas");
  const queueColl = mongodb.db("pool").collection("queue");

  
  const newJobPayload = EJSON.parse(payload.body.text());
  console.log(newJobPayload);


  // create the new job document
  const newJob = {
    status: "inQueue",
    createdTime: new Date(),
    startTime: null, 
    endTime: null, 
    priority: 1, 
    numFailures: 0, 
    failures: [], 
    result: null, 
    payload: newJobPayload, 
    logs: {},
  };
  
  // we are looking for jobs in the queue with the same payload that have not yet started (startTime == null)
  const filterDoc = {payload: payload, startTime: null};
  const updateDoc = {$setOnInsert: newJob};
  
  // upsert the new job and return if the upsertedId if the job was added to the queue
  return queueColl.updateOne(filterDoc, updateDoc, {upsert: true}).then(result => {
    if (result.upsertedId) {
      return result.upsertedId;
    } else {
      return "Already Existed";
    }}, (error) => {
      return error;
    });
};