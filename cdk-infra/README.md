# Docs Platform

## Tips

My approach when recreating the current AWS infrastructure is to reference the CloudFormation templates and serverless.yml files. So, when going through my changes, it might help to also check these files as well.

## Testing

To verify the CloudFormation is being generated successfully, you can use the `cdk synth` command to generate the CloudFormation. In the `/cdk-infra` directory, execute the following command:

```zsh
npm run cdk synth -- -c enhanced=true -c featureName=enhancedApp > cdk.out/template.yaml
```

Make sure to update your `~/.aws/credentials` file. The `enhanced` context variable, if set to true, will use the `Dockerfile.enhanced` dockerfile instead of the standard one. The `featureName` context variable is used to provide a different name for a custom stack other than the branch name. In the future for feature branches, the context variable `isFeature` will be used to use the Git branch name and append that to the stack name.

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
