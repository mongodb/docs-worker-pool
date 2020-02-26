exports = async function(payload, response) {
  console.log("TESTS!!!!!")
  // node module (in beta)
  
  // http service
  const httpService = context.services.get("slackHTTPService");

  // verify slack auth
  var slackAuth = context.functions.execute("validateSlackAPICall", payload);
  console.log("this is slack auth: ", slackAuth.status);
  if (!slackAuth || slackAuth.status !== 'success') {
    return slackAuth;
  }

  // get repo options for this user from slack and send over
  var entitlement = await context.functions.execute("getUserEntitlements", payload);
  console.log("this is entitlement: ", entitlement)
  if (!entitlement || entitlement.status !== 'success') {
    return 'ERROR: you are not entitled to deploy any docs repos';
  }
 
  // modify list for slack dropdown
  const repos = [];

  for (let i = 0; i < entitlement.repos.length; i++) {
    // get published branches for this repo
    const thisRepo = entitlement.repos[i];
    const [repoOwner, repoName] = thisRepo.split('/');
    const getPubBranches = context.functions.execute('getPublishedBranches');
    console.log(JSON.stringify(getPubBranches));
    let pubBranches = getPubBranches[repoName]

    // construct option for slack
    for (var k = 0; k < pubBranches.length; k++) {
      console.log("i enter here!!");
      pubBranches[k] = `${thisRepo}/${pubBranches[k]}`;
      var opt = {
        "text": {
          "type": "plain_text",
          "text": pubBranches[k],
        },
        "value": pubBranches[k]
      };
      repos.push(opt);
    }
  }

const  block = {
    "trigger_id": payload.query.trigger_id,
    "view": {
      "type": "modal",
      "title": {
        "type": "plain_text",
        "text": "Deploy Docs",
        "emoji": true
      },
      "submit": {
        "type": "plain_text",
        "text": "Submit",
        "emoji": true
      },
      "close": {
        "type": "plain_text",
        "text": "Cancel",
        "emoji": true
      },
      "blocks": [
        {
          "type": "input",
          "block_id": "block_repo_option",
          "element": {
            "type": "multi_static_select",
            "action_id": "repo_option",
            "placeholder": {
              "type": "plain_text",
              "text": "Select a repo to deploy",
              "emoji": true
            },
            "options": repos,
          },
          "label": {
            "type": "plain_text",
            "text": "Select Repo",
            "emoji": true
          }
        },
        {
          "type": "input",
          "block_id": "block_hash_option",
          "element": {
            "type": "plain_text_input",
            "action_id": "hash_option",
            "placeholder": {
              "type": "plain_text",
              "text": "Enter a commit hash (defaults to latest master commit)"
            }
          },
          "optional": true,
          "label": {
            "type": "plain_text",
            "text": "Commit Hash"
          }
        }
      ]
    }
  };
  
  const http = context.services.get("slackHTTPService");
  const token = context.values.get("slack_token");
  
  // post to slack to open modal
  // https://api.slack.com/surfaces/modals/using#opening_modals
  return http.post({
    url: "https://slack.com/api/views.open",
    headers: {
      "Authorization": [
        `Bearer ${token}`
      ]
    },
    body: block,
    encodeBodyAsJSON: true
  })
  .then(response => {
    // The response body is encoded as raw BSON.Binary. Parse it to JSON.
    const ejson_body = EJSON.parse(response.body.text());
    console.log("ejson boddy: ", ejson_body)
    console.log('modal opening', JSON.stringify(ejson_body));
    return 'opening modal';
  })
  
};