import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AutoBuilderStack } from '../lib/auto-builder-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/cdk-infra-stack.ts
test('The stack contains a SQS queue', () => {
  const app = new cdk.App();
  // WHEN
  console.log(process.env);
  const stack = new AutoBuilderStack(app, 'MyTestStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  });
  // THEN
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SQS::Queue', 1);
});
