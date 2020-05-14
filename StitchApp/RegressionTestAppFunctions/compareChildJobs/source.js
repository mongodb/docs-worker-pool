exports = function(commitHash, testJobs, prodJobs){
  //retrieve child jobs from regression database 
  //somehow make a list
  const repos = context.functions.execute('getReposApprovedForTesting');
  repos.forEach((repo) => {
    const testJob = testJobs[repo];
    const prodJob = prodJobs[repo];
    let testTime;
    let prodTime;
    let testLink;
    let prodLink;
    let testLinkCode;
    let prodLinkCode;
    console.log(testJob.numFailures);
    console.log(prodJob.numFailures);
    
    //compare status
    const testStatus = testJob.status;
    const prodStatus = prodJob.status;
    const testLogs = testJob.logs; 
    const prodLogs = prodJob.logs;
    //compare time it took in seconds, only get an endTime if job completed 
    //also compare results of curl-ing the link in Summary, which is only generated if job completes
    if (testStatus === "completed"){
      testTime = (testJob.endTime - testJob.startTime)/1000;
      //lastMessage.indexOf('Summary')
      testLink = testLogs[testLogs.length - 1].split('Hosted at:')[0];
      context.http.head({ url: testLink })
        .then(response => {
      // The response body is encoded as raw BSON.Binary. Parse it to JSON.
          const ejson_body = EJSON.parse(response.body.text());
          testLinkCode = ejson_body;
          console.log("this is testlink ", testLinkCode, testTime, testLink);
        })
    }
    
    if (prodStatus === "completed"){
       prodTime = (prodJob.endTime - testJob.startTime)/1000;
       prodLink = prodLogs[prodLogs.length - 1].split('Hosted at:')[0];
       context.http.head({ url: prodLink })
        .then(response => {
      // The response body is encoded as raw BSON.Binary. Parse it to JSON.
          const ejson_body = EJSON.parse(response.body.text());
          prodLinkCode = ejson_body;
        });
       console.log("this is it! ", prodLinkCode, prodTime, prodLink)
    }
   
    //compare num of failures
    const numTestFails = testJob.numFailures;
    const numProdFails = prodJob.numFailures;
    
    //then check for errors
    const testFailures = testJob.failures
    const prodFailures = prodJob.failures 
    
    const summaryMsg = 'test test'
    context.functions.execute('sendSummaryOnSlack', summaryMsg);
    
  });
  

};