import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AutoBuilderStack } from '../lib/stacks/auto-builder-stack';

describe('autobuilder stack tests', () => {
  it('The stack contains the expected number of resources', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AutoBuilderStack(app, 'MyTestStack', {
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    });
    // THEN
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::Lambda::Function', 6);
    template.resourceCountIs('AWS::SQS::Queue', 2);
  });

  it('snapshot test', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AutoBuilderStack(app, 'MyTestStack', {
      env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    });
    // THEN
    const template = Template.fromStack(stack);

    expect(template.toJSON()).toMatchSnapshot();
  });
});
