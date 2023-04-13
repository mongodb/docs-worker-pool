import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AutoBuilderStack } from '../lib/auto-builder-stack';

// example test. To run these tests, uncomment this file along with the
// example resource in lib/cdk-infra-stack.ts
test('The stack is created with no issue', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new AutoBuilderStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::SQS::Queue', 0);
});
