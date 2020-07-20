exports = async function(payload) {
  const jobUserName  = payload.pusher.name;
  const db_name_test = context.values.get("db_name");
  const coll_name = context.values.get("admin_coll");
  var admins_arr = []
  const admin_collection = await context.services.get("mongodb-atlas").db(db_name_test).collection(coll_name).find({})
    .toArray()
    .then(users => {
  
      console.log(users)
      admins_arr = users
    });


  if(admins_arr.some( admin => admin['github_username'] == jobUserName) && payload.branchName == 'master' && payload.repoName == 'docs-node'){
    try {
      let jobTitle     = "Github Push: " + payload.repository.full_name;
      let jobUserEmail = payload.pusher.email;
      const newPayload = {
        jobType:    "prodDeploy",
        source:     "github", 
        action:     "push", 
        repoName:   payload.repository.name, 
        branchName: payload.ref.split("/")[2],
        isFork:     payload.repository.fork, 
        private:    payload.repository.private,
        isXlarge:   true,
        repoOwner:  payload.repository.owner.login,
        url:        payload.repository.clone_url,
        newHead:    payload.after,
        commit:     payload.commits[0].id
      }; 
      
      context.functions.execute("addJobToQueue", newPayload, jobTitle, jobUserName, jobUserEmail);  
    } catch(err) {
      console.log(err);
    }
  }
};
