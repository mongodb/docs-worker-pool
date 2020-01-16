exports = function(payload){
  
  // console.log("source: ", payload.fullDocument.source, ", target: ", payload.fullDocument.target);
  console.log(JSON.stringify(payload));
  if (payload === undefined ||
      payload.fullDocument === undefined ||
      payload.fullDocument.name === undefined ||
      payload.fullDocument.url === undefined) {
        //send message to admin
        return;
      }
        
  const translatedPayload = { "isXlarge": true, "jobType": "publishDochub", "source": payload.fullDocument.name, "target": payload.fullDocument.url };
  //, "email": "sue.kerschbaumer@10gen.com" };
  
  context.functions.execute("addJobToQueue", translatedPayload, "dochub admin", "Dochub Admin", "sue.kerschbaumer@10gen.com"); 
  // payload, jobTitle, jobUserName, jobUserEmail
  // name -- source
  // url -- target
  
  // also need email
  
  
};