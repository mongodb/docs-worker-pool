exports = function(payload) {
  
  var returnObject = { status: 'failure' };
  
  // params needed to verify for slack
  let headerSlackSignature = payload.headers['X-Slack-Signature'].toString(); // no idea why `typeof <sig>` = object
  const timestamp = payload.headers['X-Slack-Request-Timestamp'];
  const signingSecret = context.values.get('slack_signing_secret');
  const version = 'v0';
  
  // combine query object into string
  // so strange: https://docs.mongodb.com/stitch/services/http/#request-payload
  const queryString = payload.body.text();
  
  // combine for auth and encrypt
  const slackAuth = `${version}:${timestamp}:${queryString}`;
  const enc = `${version}=` + utils.crypto.hmac(slackAuth, signingSecret, 'sha256', 'hex');
  
  // validate here
  if (enc !== headerSlackSignature) {
    console.log('ERROR: slack auth failed');
    return returnObject;
  }
  
  returnObject.status = 'success';
  return returnObject;
  
};