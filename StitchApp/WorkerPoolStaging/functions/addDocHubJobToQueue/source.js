exports = function(payload){
  
  console.log("source: ", payload.fullDocument.source, ", target: ", payload.fullDocument.target);
  // console.log(JSON.stringify(payload.fullDocument));
  
};