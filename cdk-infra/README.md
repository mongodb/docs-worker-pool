# Docs Platform

This project manages the deployment and creation of AWS infrastructure for the enhanced Autobuilder

## Adding Environment Variables

One area that will need to be actively maintained in the enhanced Autobuilder is configuring the environment variables. How the environment variables are set will be slightly different for the webhooks and the worker constructs. Also, they will be different depending on whether or not the environment variable is a secure string from the Parameter Store or not.

### Adding Non-Secure Strings from Parameter Store

The way to add non-secure strings for both can be done as follows:

```ts
const githubBotUsername = StringParameter.valueFromLookup(this, `${ssmPrefix}/github/bot/username`);

this.environment = {
  ...secureStrings,
  GITHUB_BOT_USERNAME: githubBotUsername,
};
```

First, we call the `valueFromLookup` method with the path of parameter.

Second, we then add the parameter to the `this.environment` object with the key being the environment variable name.

The `ssmPrefix` variable is defined by this function:

```ts
export function getSsmPathPrefix(): string {
  const env = getEnv();

  return `/env/${env}/docs/worker_pool`;
}
```

This is a convenience method to ensure environment parity, and to not have to append `/docs/worker_pool` to every variable we want to retrieve.

The files where these should be added are the [lib/constructs/worker/worker-env-construct.ts](lib/constructs/worker/worker-env-construct.ts) and [lib/constructs/api/webhook-env-construct.ts](lib/constructs/api/webhook-env-construct.ts) files.

### Adding Secure Strings from Parameter Store

To add a secure string from the Parameter Store, you will need to update the [utils/ssm.ts file](utils/ssm.ts). The updates need to be made in the `(worker | webhook)SecureStrings` array, and the `(worker | webhook)ParamPathToEnvName` map. The `(worker | webhook)SecureStrings` are the parameter paths in Parameter Store. They only need to contain the portion after `/env/${env}/docs/worker_pool` since the `ssmPrefix` will append the rest to it.

For example, if I want to add the GitHub Bot password environment variable `/env/${env}/docs/worker_pool/github/bot/password` for the webhooks, you would do the following:

```ts
const webhookSecureStrings = ['/github/bot/password'] as const;

webhookParamPathToEnvName.set('/github/bot/password', 'GITHUB_BOT_PASSWORD');
```

The process is the same with the worker, but you will update `workerSecureStrings` and `workerParamPathToEnvName` instead.

### Worker

For the worker, any changes made in the `config/` directory JSON files will not need to be copied over anywhere for the CDK project. Since the worker is built using Docker, the updated `config/` JSON files will already be included.

### Webhooks

For the webhooks, any additions made in the `api/config` JSON files will need to be included in the `cdk-infra/static/api/config` directory as well.

## Tips

To verify the AWS CDK code adequately replicates the current AWS infrastructure, it is helpful to reference the CloudFormation templates that exist within the `infrastructure` directory, as well as understanding the `serverless.yml` files' contents.

## Testing

To verify the CloudFormation is being generated successfully, you can use the `cdk synth` command to generate the CloudFormation. In the `/cdk-infra` directory, execute the following command:

```zsh
npm run cdk synth -- -c enhanced=true -c customFeatureName=enhancedApp > cdk.out/template.yaml
```

Make sure to update your `~/.aws/credentials` file. The `enhanced` context variable, if set to true, will use the `Dockerfile` dockerfile instead of the standard one. The `featureName` context variable is used to provide a different name for a custom stack other than the branch name. In the future for feature branches, the context variable `isFeature` will be used to use the Git branch name and append that to the stack name.

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
