const fs = require('fs');

module.exports = () => {
  try {
    const outputsFile = fs.readFileSync('cdk-infra/outputs.json').toString();
    const outputs = JSON.parse(outputsFile);
    console.log('github', github);
    console.log(github.head_ref);
    console.log(outputsFile);
    const webhook = Object.values(outputs[`auto-builder-stack-enhancedApp-stg-${process.env.GIT_BRANCH}-webhooks`])[0];
    return webhook;
  } catch (error) {
    console.log('Error occurred when retrieving Webhook URL');
    return '';
  }
};
