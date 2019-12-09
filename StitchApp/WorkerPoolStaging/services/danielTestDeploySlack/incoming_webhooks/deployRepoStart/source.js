exports = async function(payload, response) {
  
  // verify slack auth
  var slackAuth = context.functions.execute("validateSlackAPICall", payload);
  if (!slackAuth || slackAuth.status !== 'success') {
    return slackAuth;
  }
  
  console.log('----- BEGIN JOB FROM SLACK ------');
  
  // https://api.slack.com/interactivity/handling#payloads
  var parsed = JSON.parse(payload.query.payload);
  var stateValues = parsed.view.state.values; 
  
  // get repo options for this user from slack and send over
  var entitlement = await context.functions.execute("getUserEntitlements", {
    'query': {
      'user_id': parsed.user.id
    }
  });
  if (!entitlement || entitlement.status !== 'success') {
    return 'ERROR: you are not entitled to deploy any docs repos';
  }
  
  console.log('user deploying job', JSON.stringify(entitlement));
  
  /*
    // sample of how stateValues looks
    // https://api.slack.com/reference/interaction-payloads/views#view_submission
    "{\"block_branch_option\":{\"branch_option\":{\"type\":\"external_select\"}},\"block_hash_option\":{\"hash_option\":{\"type\":\"plain_text_input\"}},\"block_repo_option\":{\"repo_option\":{\"selected_option\":{\"text\":{\"emoji\":true,\"text\":\"mongodb/docs-bi-connector\",\"type\":\"pl",
  */
  
  // mapping of block id -> input id
  var values = {};
  var inputMapping = {
    'block_repo_option': 'repo_option',
    'block_branch_option': 'branch_option',
    'block_hash_option': 'hash_option',
  };
  
  // get key and values to figure out what user wants to deploy
  for (var blockKey in inputMapping) {
    var blockInputKey = inputMapping[blockKey];
    var stateValuesObj = stateValues[blockKey][blockInputKey];
    // selected value from dropdown
    if (stateValuesObj && stateValuesObj.selected_option && stateValuesObj.selected_option.value) {
      values[blockInputKey] = stateValuesObj.selected_option.value;
    } 
    // input value
    else if (stateValuesObj && stateValuesObj.value) {
      values[blockInputKey] = stateValuesObj.value;
    } 
    // no input
    else {
      values[blockInputKey] = null;
    }
  }
  
  console.log(11, JSON.stringify(stateValues));
  console.log(22, JSON.stringify(values));
  return 'success';
    
};