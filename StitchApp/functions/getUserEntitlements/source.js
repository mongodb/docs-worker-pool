exports = async function(payload) {
  
  var returnObject = { status: 'failure' };
  
  const db_name = context.values.get('db_name');
  const coll_name = 'entitlements';
  const slack_user_id = payload.query.user_id;
  
  // get the queue collection
  const entitlementDocuments = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);
  const entitlementMapping = await entitlementDocuments.findOne({ 'slack_user_id': slack_user_id });
  
  // if user has specific entitlements
  if (entitlementMapping && entitlementMapping.repos && entitlementMapping.repos.length > 0) {
    returnObject.repos = entitlementMapping.repos;
    returnObject.github_username = entitlementMapping.github_username;
    returnObject.status = 'success';
  }
  
  return returnObject;
  
};