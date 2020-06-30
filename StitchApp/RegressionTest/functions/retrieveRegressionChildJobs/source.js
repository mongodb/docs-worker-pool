/* this function is associated with the regressionTestJobCompleted trigger.
   Whenever a regression test child process in the staging db finishes, this is 
   code is executed. This function checks if there are any other regression test 
   child processes still in progress. 

   If all child processes have finished, the app will begin to compare the jobs 
   between the two environments. 

*/
exports = async function(changeEvent) {
    const fullDocument = changeEvent.fullDocument;

    const coll_name = context.values.get("coll_name");
    
    /*collection from which to retrieve child jobs in test env */
    const db_name_test = context.values.get("db_name_test_env");
    const collection_test = await context.services.get("mongodb-atlas").db(db_name_test).collection(coll_name);

    /*collection from which to retrieve child jobs in prod env */
    const db_name_prod = context.values.get("db_name_test_env");
    const collection_prod = await context.services.get("mongodb-atlas").db(db_name_prod).collection(coll_name);
    
    /*collection to consolidate child jobs */
    const regress_db_name = context.values.get("regression_db");
    const regress_col_name = context.values.get("autoworker_coll");
    const regression_collection = await context.services.get("mongodb-atlas").db(regress_db_name).collection(regress_col_name);
    
    let testJobs = {}; 
    let prodJobs = {};
    let stageDbComplete;
    let prodDbComplete;
    const numOfReposTested = context.functions.execute('getReposApprovedForTesting').length;
    const commitHash = fullDocument.payload.newHead;
    //count completed child jobs in the staging server to see if regression testing is complete 
      await collection_test.find({"status": { $nin: ["inProgress", "inQueue"]}, "payload.newHead": commitHash})
      .toArray()
      .then(items => {
        if(items.length === numOfReposTested){
          stageDbComplete = true
          items.forEach(function(childJob) {
            regression_collection.insertOne(childJob);
            testJobs[childJob.payload.repoName] = childJob;
          })
        }
      })
  .catch(err => console.error(`Failed to find documents: ${err}`));

    //count completed child jobs in the prod server to see if regression testing is complete    
    await collection_test.find({"status": { $nin: ["inProgress", "inQueue"]}, "payload.newHead": commitHash})
      .toArray()
      .then(items => {
        if(items.length === numOfReposTested){
          prodDbComplete = true;
          items.forEach(function(childJob) {
            regression_collection.insertOne(childJob);
            prodJobs[childJob.payload.repoName] = childJob;
          })
        }
      })
  .catch(err => console.error(`Failed to find documents: ${err}`));
  if(stageDbComplete === true && prodDbComplete === true){
    context.functions.execute("compareChildJobs", testJobs, prodJobs);  
  }
  
   
}
