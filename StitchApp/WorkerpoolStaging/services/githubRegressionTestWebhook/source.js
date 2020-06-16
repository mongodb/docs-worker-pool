/*
This function is called when the payload is hit from the github webhook 

It creates a payload for each docs repo and then calls a function to create a job with the supplied payload and insert it in the respective database
*/
  
exports = async function(payload) {
  var result = context.functions.execute("validateNewJob", payload);

  if (!result.valid) {
    return result.error ;
  }
  const coll_name = context.values.get("coll_name");
  const db_name_test = context.values.get("db_name");
  
  const collection_test = await context.services.get("mongodb-atlas").db(db_name_test).collection(coll_name);
  const reposApprovedForTesting = context.functions.execute("getReposApprovedForTesting")


  const jobUserName  = payload.pusher.name;
  const jobUserEmail = payload.pusher.email;
  const jobTitle = "Regression Test Child Process";
  
  /*create payloads */
  reposApprovedForTesting.forEach((repo) => {
    const repoOwnerArg = repo["owner"];
    const repoNameArg = repo["name"];

    const newPayload = {
      jobType: "githubPush",
      source: "github",
      action: "push",
      repoName: repoNameArg,
      branchName: "master",
      isFork: true,
      private: repo["private"],
      isXlarge: true,
      repoOwner: repoOwnerArg,
      url: `https://github.com/${repoOwnerArg}/${repoNameArg}`,
      newHead: payload.after
      };
    console.log(JSON.stringify(newPayload))

    context.functions.execute("addJobToQueue", newPayload, jobTitle, jobUserName, jobUserEmail);
  });

};