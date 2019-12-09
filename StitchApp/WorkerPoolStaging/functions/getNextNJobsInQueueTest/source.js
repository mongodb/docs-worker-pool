exports = function(n, type){
  
  let ret = {};
  if (type === "jobsInQueue") {
    ret = { startTime: null, endTime: null };
  } else if (type === "jobsInProgress") {
    ret = { startTime: {$ne: null}, endTime: null };
  } else if (type === "jobsCompleted") {
    ret = {
    	startTime: {$ne: null},
    	endTime: {$ne: null},
    	numFailures: {$lt: 3},
    //	results: {$ne: null},
    };
  } else if (type === "jobsFailed") {
    ret = { numFailures: {$gte: 3} };
  } else if (type === "jobsAll")  {
    ret = {};
  }
  else if (type !== undefined) {
    ret = {user: type};
  }
  
  const db_name = context.values.get("db_name");
  const coll_name = context.values.get("coll_name");
  
  var queueCollection = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);
  return queueCollection
      .find(ret)
      .sort({"createdTime": -1})
      .limit(n)
      .toArray();
};