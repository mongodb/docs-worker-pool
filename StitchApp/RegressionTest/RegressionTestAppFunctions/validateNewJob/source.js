exports = function(payload) {
  
  // do some kind of validation'
  var returnObject = {
    valid: true,
  };
  
  // deleting a branch should not kick off build
  if (payload.newHead && payload.newHead.match('^[0]+$')) {
    returnObject.valid = false;
    returnObject.error = 'branch deleted so new build will not start';
  }
  
  console.log('validation: ', JSON.stringify(returnObject));
  return returnObject;
  
};