exports = function(arg){
  
  var queue = context.services.get("mongodb-atlas").db("pool").collection("queue");
  
  update = {$set: {
    status: "inQueue",
    startTime: null, 
    endTime: null,
    priority: 1, 
    result: null,
    failures: [],
    numFailures: 0, 
    logs: {},
  }};  
  
  queue.updateMany({}, update);
  return {arg: arg};
};