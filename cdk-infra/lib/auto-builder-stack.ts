import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AutoBuilderConstruct } from './constructs/auto-builder-construct';
import { getCurrentBranch } from '../utils/git';

interface AutoBuilderStackProps extends StackProps {
  workerSecureStrings: Record<string, string>;
  webhookSecureStrings: Record<string, string>;
}
export class AutoBuilderStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    { workerSecureStrings, webhookSecureStrings, ...props }: AutoBuilderStackProps
  ) {
    super(scope, id, props);

    let stackName = 'auto-builder-stack';

    // If we want to create a specific feature, we will use this name.
    // NOTE: This value will take precedence over the feature branch name so that
    // we can deploy and update the same stack for a specific feature between branches.
    const customFeatureName = this.node.tryGetContext('featureName');

    // If this is a feature branch i.e., it's not master, use this name.
    const isFeatureBranch = this.node.tryGetContext('isFeature');

    if (customFeatureName) {
      stackName += `-${customFeatureName}`;
    } else if (isFeatureBranch) {
      stackName += `-${getCurrentBranch()}`;
    }

    const autoBuilderConstruct = new AutoBuilderConstruct(this, stackName, {
      workerSecureStrings,
      webhookSecureStrings,
    });

    Tags.of(autoBuilderConstruct).add('workerStack', stackName);
  }
}
