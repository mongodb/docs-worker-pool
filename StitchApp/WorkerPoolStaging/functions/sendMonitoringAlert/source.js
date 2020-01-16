exports = async function(monitorMessage, mongoEmail){
  if (mongoEmail === null
      || monitorMessage === null) {
        console.log('no message/recipient for alert');
        return;
  }
  // Slack Constants
  const scheme = "https";
  const host = "slack.com";
  const postMessage = "api/chat.postMessage";
  const lookupUser = "api/users.lookupByEmail"; 
  const token = context.values.get("slack_token");
  
  // Get the Slack Service
  const slack = context.services.get("slackHTTPService");
  
  // Split email into mongoEmail and tenGenEmail or fail 
  
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
  
  console.log(JSON.stringify(getRequest));
  
  // Issue the get request
  let getResp = await slack.get(getRequest);
  console.log(JSON.stringify(getResp));
  
  getResp = await EJSON.parse(getResp.body.text());

  // If we did not get the email --> try the other one
  if (getResp.ok === false) {
    console.log("Couldnt find the slack email for user:" + email);
  } else {
    console.log('found slack email');
  }
  
  // Compose the message including the job link
  let message = "Snooty Alert: " + monitorMessage;
  
  console.log(message);
  
  console.log('user id:' + getResp.user);
  
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
  return postResp;
};