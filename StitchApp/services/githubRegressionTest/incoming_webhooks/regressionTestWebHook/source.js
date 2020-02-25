/*
  See https://developer.github.com/v3/activity/events/types/#webhook-payload-example for
  examples of payloads.

  Try running in the console below.
*/
  
exports = function(payload) {
  var result = context.functions.execute("validateNewJob", payload);

  if (!result.valid) {
    return result.error ;
  }
  
  console.log(payload.repository.name);
  
  try {
    let jobTitle     = "Github Push: " + payload.repository.full_name;
    let jobUserName  = payload.pusher.name;
    let jobUserEmail = payload.pusher.email;
    const newPayload = {
      jobType:    "regressionTest",
      source:     "github", 
      action:     "push", 
      repoName:   payload.repository.name, 
      branchName: payload.ref.split("/")[2],
      isFork:     payload.repository.fork, 
      private:    payload.repository.private,
      isXlarge:   false,
      repoOwner:  payload.repository.owner.login,
      url:        payload.repository.clone_url,
      newHead:    payload.after,
    }; 
    
    console.log(JSON.stringify(newPayload));
    
    context.functions.execute("addJobToQueue", newPayload, jobTitle, jobUserName, jobUserEmail);  
  } catch(err) {
    console.log(err);
  }
  
};