exports = async function(payload){
  // Slack Constasnts
  const scheme = "https";
  const host = "slack.com";
  const postMessage = "api/chat.postMessage";
  const lookupUser = "api/users.lookupByEmail";
  const token = context.values.get("slack_token");
  
  // Get the Slack Service
  const slack = context.services.get("slackHTTPService");
  
  // URL for the jobs dashboard site
  const jobUrl = "https://workerpool-boxgs.mongodbstitch.com/pages/job.html?jobId=";
  
  // Extract information from the payload
  const jobTitle = payload.fullDocument.title;
  const jobId = payload.fullDocument._id;
  const email = payload.fullDocument.email;
  const repoName = payload.fullDocument.payload.repoName;
  
  // Split email into mongoEmail and tenGenEmail or fail 
  let splits = email.split("@");
  if (splits[1] === "mongodb.com") {
    mongoEmail  = email;
    tenGenEmail = splits[0] + "@10gen.com";
  } else if (splits[1] === "10gen.com") {
    tenGenEmail = email;
    mongoEmail  = splits[0] + "@mongodb.com";
  } else {
    console.log("Invalid email: " + email);
    return;
  }
  
  console.log("Update to: " + jobTitle + " (" + jobId + ")");
  console.log(JSON.stringify(payload.updateDescription));
  
  // Compose the get request
  let getRequest = {
    scheme: scheme,
    host: host,
    path: lookupUser,
    query: {
      token: [token], 
      email: [mongoEmail],
    },
  };
  
  // Issue the get request
  let getResp = await slack.get(getRequest);
  getResp = EJSON.parse(getResp.body.text());

  console.log(payload.fullDocument);
  // If we did not get the email --> try the other one
  if (getResp.ok === false) {
    console.log("Couldnt find the mongodb email");
    
    getRequest.query.email = [tenGenEmail];
    getResp = await slack.get(getRequest);
    getResp = EJSON.parse(getResp.body.text());
    
    if (getResp.ok === false) {
      console.log("Couldnt Find Either Email: [" + mongoEmail + ", " + tenGenEmail + "]");
      return;
    }
  }
  
  // Compose the message including the job link
  let message = "Your Job (<" + jobUrl + jobId + "|" +  jobTitle + ">) ";  
  if (payload.operationType === "insert") {
    message += "has successfully been added to the queue.";
  } else {
    let newStatus = payload.fullDocument.status;
    if (newStatus === "inQueue") {
      message += "has been moved back into the job queue (" 
          + payload.fullDocument.numFailures + " times)";
      try {
        let failures = payload.fullDocument.failures;
        let lastFailure = failures[failures.length - 1];
        message += " with error {" + lastFailure.reason + "}.";
      } catch(err) {
        console.log("Error: " + err);
      }
    } else if (newStatus === "inProgress") {
      message += "is now being processed.";
    } else if (newStatus === "completed") {
      if (payload.fullDocument.comMessage !== undefined) {
        const slackMsgs = payload.fullDocument.comMessage;
        message += (slackMsgs.toString().indexOf('WARNING:') !== -1) ? 
          " has completed but there were WARNINGS. " : 
          " has successfully completed. ";
        // format each message we are about to send to slack
        // this is the combination of all builds outputs, errors, and staging output
        if (repoName !== 'docs') {
          for (let i = 0; i < slackMsgs.length; i++) {
            if (i < (slackMsgs.length - 1)) {
              message += '\n' + '```' + slackMsgs[i] + '```';
            } else {
              message += '\n' + slackMsgs[i];
            }
          } 
        } else {
          // this only sends the staging outut to slack
          message += '\n' + slackMsgs[slackMsgs.length - 1];
        }
        message += '\n' + "Enjoy!";
        // testing
        console.log('THIS IS THE MESSAGE TO SLACK!!!!!', message.length);
        console.log(message);
      }
    } else if (newStatus === "failed") {
      message += "has failed " + payload.fullDocument.numFailures 
          + " times and will not be placed back in the queue.";
    } else {
      message += "has been updated to an unsupported status.";
    }
  }
  console.log(message);
  
  // Compose the post request
  let postRequest = {
    scheme: scheme,
    host: host,
    path: postMessage,
    query: {
      token: [token], 
      channel: [getResp.user.id],
      text: [message],
     },
  }; 
  
  // Issue the post request
  let postResp = await slack.post(postRequest);
  postResp = EJSON.parse(postResp.body.text());
  
  console.log(222222, postResp);
  
  // Log and return the answer
  console.log(JSON.stringify(postResp));
  return postResp;
};