exports = async function(summaryMessage){
  
  // Slack Constants
  const scheme = "https";
  const host = "slack.com";
  const postMessage = "api/chat.postMessage";
  const lookupUser = "api/users.lookupByEmail"; 
  const token = context.values.get("slack_token");
  
  // Get the Slack Service
  const slack = context.services.get("slackHTTPService");
  
  const admins = context.functions.execute("getAdmins");
  admins.forEach( async (admin) =>  {
    
      // Compose the get request
  const getRequest = {
    scheme: scheme,
    host: host,
    path: lookupUser,
    query: {
      token: [token], 
      email: [admin],
    },
  };
  
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
  

  console.log('user id:' + getResp.user);
  
  // Compose the post request
  let postRequest = {
    scheme: scheme,
    host: host,
    path: postMessage,
    query: {
      token: [token], 
      channel: [getResp.user.id],
      text: [summaryMessage],
    },
  }; 

  // Issue the post request
  let postResp = await slack.post(postRequest);
  postResp = EJSON.parse(postResp.body.text());
  return postResp;
  });
}


  