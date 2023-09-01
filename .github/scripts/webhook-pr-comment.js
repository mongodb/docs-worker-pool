const fs = require('fs');
const path = require('path');
module.exports = () => {
  try {
    const outputsFile = fs.readFileSync('cdk-infra/outputs.json').toString();
    const outputs = JSON.parse(outputsFile);

    const webhook = Object.values(outputs[`auto-builder-stack-enhancedApp-stg-${process.env.GIT_BRANCH}-webhooks`])[0];
    return webhook;
  } catch (error) {
    console.log('Error occurred when retrieving Webhook URL', error);
    return '';
  }
};
