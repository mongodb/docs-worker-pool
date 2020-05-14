exports = async function(changeEvent) {
    const fullDocument = changeEvent.fullDocument;
    const coll_name = context.values.get("coll_name");
    
    /*collection from which to retrieve child jobs in test env */
    const db_name_test = context.values.get("db_name_test_env");
    const collection_test = context.services.get("mongodb-atlas").db(db_name_test).collection(coll_name);
    
    /*collection from which to retrieve child jobs in prod env */
    //const db_name_prod = context.values.get("db_name_prod_env");
    const db_name_prod = context.values.get("db_name_test_env");
    const collection_prod = context.services.get("mongodb-atlas").db(db_name_prod).collection(coll_name);
    
    /*collection to consolidate child jobs */
    const regress_db_name = context.values.get("regression_db");
    const regress_col_name = context.values.get("autoworker_coll");
    const regression_collection = context.services.get("mongodb-atlas").db(regress_db_name).collection(regress_col_name);

    let testJobs = {}; 
    let prodJobs = {};
    const commitHash = fullDocument.payload.newHead;
    
    //insert completed test child jobs to regression test db
    collection_test.find({ "payload.newHead": commitHash})
      .toArray()
      .then(items => {
        console.log(`Successfully found ${items.length} documents.`);
        items.forEach(function(childJob) {
          regression_collection.insertOne(childJob);
          testJobs.repos.childJob.payload.repoName = childJob;
          //how to log errors here?
        }
      );
      })
    .catch(err => console.error(`Failed to find documents: ${err}`));
  
    //insert prod child jobs to regression test db, regardless of completion    
    collection_prod.find({ "payload.newHead": commitHash})
      .toArray()
      .then(items => {
        console.log(`Successfully found ${items.length} documents.`);
        items.forEach(function(childJob) {
          regression_collection.insertOne(childJob);
          prodJobs.repos.childJob.payload.repoName = childJob;
          //how to log errors here?
        }
      );
      })
  .catch(err => console.error(`Failed to find documents: ${err}`));
  
  context.functions.execute("compareChildJobs", commitHash, testJobs, prodJobs);
   
}
