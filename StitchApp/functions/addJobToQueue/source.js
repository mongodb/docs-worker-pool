exports = function(payload, jobTitle, jobUserName, jobUserEmail){
  // first validate the payload()
  var result = context.functions.execute("validateNewJob", payload);
  if (!result.valid) {
    return result.error ;
  }
  
  console.log(JSON.stringify(context.user));
  
  const db_name = context.values.get("db_name");
  const coll_name = context.values.get("coll_name");
  
  // get the queue collection
  var queue = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);
  
  // create the new job document
  const newJob = {
    title: jobTitle,
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
    payload: payload, 
    logs: {},
  };
  
  // we are looking for jobs in the queue with the same payload that have not yet started (startTime == null)
  const filterDoc = {payload: payload, startTime: null};
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