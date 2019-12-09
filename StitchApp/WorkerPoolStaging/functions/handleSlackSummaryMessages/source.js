exports = async function(payload){
    
  // Slack Constasnts
  const scheme = "https";
  const host = "slack.com";
  const postMessage = "api/chat.postMessage";
  const lookupUser = "api/users.lookupByEmail"; 
  const token = context.values.get("slack_token");
  
  // Get the Slack Service
  const slack = context.services.get("slackHTTPService");
  
  // get username/email mapping
  var usernameMapping = context.functions.execute("getUsernameMapping");
  
  // URL for the jobs dashboard site
  const jobUrl = "https://workerpoolstaging-qgeyp.mongodbstitch.com/pages/job.html?jobId=";
  
  // Extract information from the payload
  const jobTitle = payload.fullDocument.title;
  const jobId = payload.fullDocument._id;
  const email = payload.fullDocument.email;
  const repoName = payload.fullDocument.payload.repoName;
  const username = payload.fullDocument.user;
  
  // Split email into mongoEmail and tenGenEmail or fail 
  let splits = email.split("@");
  if (splits[1] === "mongodb.com") {
    mongoEmail  = email;
    tenGenEmail = splits[0] + "@10gen.com";
  } else if (splits[1] === "10gen.com") {
    tenGenEmail = email;
    mongoEmail  = splits[0] + "@mongodb.com";
  } else {
    console.log('private email found, now getting email from mapping object');
    if (usernameMapping[username]) {
      tenGenEmail = usernameMapping[username];
      mongoEmail = tenGenEmail.replace('10gen.com', 'mongodb.com');
    } else {
      console.log("Invalid email: " + email);
      return;
    }
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
  
  if (JSON.stringify(payload.updateDescription.updatedFields).indexOf('comMessage') === -1) {
    return false;
  }
  
  // split slack messages from build output and stage output
  const slackMsgs = payload.fullDocument.comMessage;
  
  // check if summary exists to send to slack 
  if (slackMsgs === undefined || slackMsgs.length === 0) {
    console.log('ERROR: Empty slack message array.');
    return false;
  }
  
  // the last message is the one that has the staging output 
  let lastMessage = slackMsgs[slackMsgs.length - 1];
  
  // if last message is incorrect format 
  if (lastMessage.indexOf('Summary') === -1) {
    console.log('ERROR: No Summary in output from build.');
    return false;
  }
  
  // mms-docs builds two sites, so account for this in slack message
  if (repoName === 'mms-docs') {
    let modMmsOutput;
    modMmsOutput = lastMessage.substr(0, lastMessage.indexOf('mut-publish'));
    modMmsOutput = modMmsOutput + '\n\n';
    modMmsOutput = modMmsOutput + lastMessage.substr(lastMessage.lastIndexOf('Summary'));
    lastMessage = modMmsOutput;
  } 
  
  // Compose the message including the job link
  let message = "Your Job (<" + jobUrl + jobId + "|" +  jobTitle + ">) "; 
  message += (slackMsgs.toString().indexOf('WARNING:') !== -1) ? 
    "finished build with *WARNINGS*. " : 
    "finished build with no warnings. ";
  // only get the summary portion of build output
  message += '\n' + lastMessage; 
  message += '\n' + "Enjoy!"; 
  message = message.replace(/\.{2,}/g, '');
  // testing
  console.log('THIS IS THE MESSAGE TO SLACK!!!!!', slackMsgs.length);
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
  
  console.log(222222, JSON.stringify(postResp));
  
  // Log and return the answer
  console.log(JSON.stringify(postResp));
  return postResp;
};