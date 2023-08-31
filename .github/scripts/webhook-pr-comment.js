const fs = require('fs');
const path = require('path');

module.exports = ({ github }) => {
  try {
    const outputsFile = fs.readFileSync(path.join(process.cwd(), 'cdk-infra/outputs.json')).toString();
    const outputs = JSON.parse(outputsFile);
    console.log('github', github);
    console.log(github.head_ref);
    console.log(outputsFile);
    const webhook = Object.values(outputs[`auto-builder-stack-enhancedApp-stg-${github.head_ref}-webhooks`])[0];
    return webhook;
  } catch (error) {
    console.log('Error occurred when retrieving Webhook URL');
    return '';
  }
};
