exports = function(jobId){
  const db_name = context.values.get("db_name");
  const coll_name = context.values.get("coll_name");
  
  var queueCollection = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);

  return queueCollection.findOne({_id: BSON.ObjectId(jobId)}).then(doc => {
      return doc;
  });
};