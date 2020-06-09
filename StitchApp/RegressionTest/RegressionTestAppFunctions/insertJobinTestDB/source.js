exports = function(payloadArg, jobUserName, jobUserEmail){
  const db_name_test = context.values.get("db_name_test_env");
  const coll_name = context.values.get("coll_name");
  
  // get the queue collection
  var queue = context.services.get("mongodb-atlas").db(db_name_test).collection(coll_name);
  
  // create the new job document
  const newJob = {
    title: "Regression Test Child Process",
    user: jobUserName, 
    email: jobUserEmail,
    status: "inQueue",
    createdTime: new Date(),
    startTime: null, 
    endTime: null, 
    priority: 1, 
    numFailures: 0, 
    failures: [], 
    result: null, 
    payload: payloadArg, 
    logs: {},
  };
  
  // we are looking for jobs in the queue with the same payload that have not yet started (startTime == null)
  const filterDoc = {payload: payloadArg, startTime: null};
  const updateDoc = {$setOnInsert: newJob};
  
  // upsert the new job and return if the upsertedId if the job was added to the queue
  return queue.updateOne(filterDoc, updateDoc, {upsert: true}).then(result => {
    if (result.upsertedId) {
      return result.upsertedId;
    } else {
      return "Already Existed";
    }}, (error) => {
      return error;
    });
};