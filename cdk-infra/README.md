# Docs Platform

This project manages the deployment and creation of AWS infrastructure for the enhanced Autobuilder

## Tips

To verify the AWS CDK code adequately replicates the current AWS infrastructure, it is helpful to reference the CloudFormation templates that exist within the `infrastructure` directory, as well as understanding the `serverless.yml` files' contents.

## Testing

To verify the CloudFormation is being generated successfully, you can use the `cdk synth` command to generate the CloudFormation. In the `/cdk-infra` directory, execute the following command:

```zsh
npm run cdk synth -- -c enhanced=true -c customFeatureName=enhancedApp > cdk.out/template.yaml
```

Make sure to update your `~/.aws/credentials` file. The `enhanced` context variable, if set to true, will use the `Dockerfile.enhanced` dockerfile instead of the standard one. The `featureName` context variable is used to provide a different name for a custom stack other than the branch name. In the future for feature branches, the context variable `isFeature` will be used to use the Git branch name and append that to the stack name.

## MongoDB Enhanced Infrastructure Commands

- `npm run deploy:enhanced` deploys the current changes to the enhanced infrastructure. This command will deploy for all of the infrastructure associated with the Autobuilder. This includes the SQS queues, ECS cluster, and API Gateway/Lambda functions.
- `npm run deploy:enhanced:worker` deploys the current changes made to the Autobuilder worker. This will only update the ECS cluster, and ECR repository.
- `npm run deploy:enhanced:webhooks` deploys the current changes made to the web hook handlers. Specifically, this will deploy changes made to the lambdas in the `api/` directory.
- `npm run deploy:feature -- -c customFeatureName=<custom-feature-name>` deploys/creates infrastructure for a custom feature. This can be used to test the Autobuilder infrastructure in isolation. This will deploy all of the Autobuilder infrastructure, and this command should be called first when creating a new feature stack for the first time.

- `npm run deploy:feature:worker <worker-stack-name> -- -c customFeatureName=<custom-feature-name>` deploys only the worker infrastructure for a given feature name.
- `npm run deploy:feature:webhooks <webhooks-stack-name> -- -c customFeatureName=<custom-feature-name>` deploys only the webhooks infrastructure for a given feature name.

# Welcome to your CDK TypeScript project (Auto-generated readme below)

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template