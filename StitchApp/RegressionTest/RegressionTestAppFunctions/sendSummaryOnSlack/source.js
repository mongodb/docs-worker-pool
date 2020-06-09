exports = async function(summaryMessage){
  
  // Slack Constants
  const scheme = "https";
  const host = "slack.com";
  const postMessage = "api/chat.postMessage";
  const lookupUser = "api/users.lookupByEmail"; 
  const token = context.values.get("slack_token");
  
  // Get the Slack Service
  const slack = context.services.get("slackHTTPService");

  /*collection from which to retrieve child jobs in test env */
  const db_name_test = context.values.get("db_name_test_env");
  const coll_name = context.values.get("admin_coll");
  const admin_collection = await context.services.get("mongodb-atlas").db(db_name_test).collection(coll_name);
  
  admin_collection.find({})
    .toArray()
    .then(users => {
      console.log(`Successfully found ${users.length} documents.`);
      users.forEach(async function(user_obj) {

        // Compose the get request
        const user_email = user_obj["slack_email"]
        let splits = user_email.split("@");
        if (splits[1] === "mongodb.com") {
          mongoEmail  = user_email;
          tenGenEmail = splits[0] + "@10gen.com";
        } else if (splits[1] === "10gen.com") {
          tenGenEmail = user_emailemail;
          mongoEmail  = splits[0] + "@mongodb.com";
        }
  
        const getRequest = {
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
        getResp = await EJSON.parse(getResp.body.text());
      
        // If we did not get the email --> try the other one
        if (getResp.ok === false) {
          console.log("Couldnt find the slack email for user:" + email);
          getRequest.query.email = [tenGenEmail];
          getResp = await slack.get(getRequest);
          getResp = EJSON.parse(getResp.body.text());
        } else {
          console.log('found slack email');
        }
        
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
        
      }
    );
    })
  .catch(err => console.error(`Failed to find documents: ${err}`));

}


  