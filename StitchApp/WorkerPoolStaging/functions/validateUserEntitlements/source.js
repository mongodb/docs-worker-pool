exports = async function(payload) {
  
  // do some kind of validation
  var returnObject = { 'valid': true };
  
  const db_name = context.values.get('db_name');
  const coll_name = 'entitlements';
  const userEmail = payload.email;
  const repoName = payload.repoName;
  let userEntitlements = [];
  
  // get the queue collection
  const entitlementDocuments = context.services.get("mongodb-atlas").db(db_name).collection(coll_name);
  const entitlementMapping = await entitlementDocuments.findOne({ 'email': userEmail });
  
  // if user has specific entitlements
  if (entitlementMapping && entitlementMapping.repos && entitlementMapping.repos.length > 0) {
    userEntitlements = entitlementMapping.repos;
  }
  
  // is user building repo they are entitled to 
  if (userEntitlements.indexOf(repoName) === -1) {
    returnObject.valid = false;
  }
  
  console.log('entitlement validation: ', JSON.stringify(returnObject));
  return returnObject;
  
};