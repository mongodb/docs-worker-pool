# Docs Worker Pool Workflows

This README describes the various workflows defined for the docs-worker-pool repository.

## Releases

The release process occurs whenever someone releases a specific tag via the GitHub UI. Three separate workflows are run upon release:

1. `deploy-prd-ecs.yml` - Builds and deploys the old Autobuilder to prd
2. `deploy-prd-enhanced-webhooks.yml` - Builds and deploys webhooks (GitHub and Slack handlers) for the enhanced Autobuilder
3. `deploy-prd-enhanced-worker.yml` - Builds and deploys the Autobuilder worker to prd

## Feature Branch Deploys

The feature branch deploy process occurs whenever a developer opens a pull request. It consists of three separate workflows:

1. `deploy-feature-branch.yml` - Creates the initial infrastructure when a PR is opened, this includes draft PRs
2. `update-feature-branch.yml` - Ran whenever a commit is made to the branch for the PR, and conditionally deploys each stack depending on changes made
3. `clean-feature-branch.yml` - Ran whenever a PR is merged or closed; deletes all of the infrastructure for the feature branch

### `deploy-feature-branch.yml`

This workflow file is only called when a PR is first opened, or re-opened after being closed. The stacks are deployed sequentially, this is based on the dependencies for each. The order is:

1. Queue stack
2. Worker stack
3. Webhook stack

The queues are only deployed once, as they almost always don't need to be updated. The worker and webhook stacks are the ones that will be updated to reflect code changes, so these will be a part of the `update-feature-branch.yml` workflow.

One thing to note: The webhook stack depends on the worker stack, but this doesn't mean they always need to be deployed sequentially every time, only for the initial deploy. This is because the webhook stack's only dependency on the worker stack is the ECS cluster name associated with the worker stack. This value does not change, and so in the `update-feature-branch.yml` workflow, we are able to deploy these in parallel.

This workflow also will comment on the pull request when the initial feature branch deploy is successful, notifying the developer on how to use their provisioned infrastructure.

### `update-feature-branch.yml`

This workflow handles subsequent commits to the branch that a pull request is a part of. Depending on what changes are made, each stack is conditionally deployed so that only the necessary stacks are updated. In a recent update, these stacks are now deployed in parallel, and caching has been added to share `node_modules` between jobs, as they are the same for all jobs.

### `clean-feature-branch.yml`

As the name suggests, this workflow cleans up the feature branch infrastructure. As well as deleting the AWS resources associated with the feature branch, the GitHub Actions cache that is created in the `update-feature-branch.yml` file is also deleted.

### Bugs

Right now, there is a small bug with the `update-feature-branch.yml` workflow. This workflow conditionally deploys the various stacks depending on what files have changed from a commit. The issue is that the custom filter action compares the PR branch to master for every workflow run. This means that if you make a change to `src/app.ts` in the first commit, but only make changes to files in the `api/` directory in subsequent commits, it will still run the deploy for the worker.

For the `deploy-feature-branch.yml` workflow, this will not re-run if the first build when opening a PR fails. This means that subsequent builds of the `update-feature-branch.yml` workflow will also fail. This is due to the fact that the SQS queues would not have been deployed. For now, the workaround is to close and re-open the PR. This will run the `deploy-feature-branch.yml` workflow.
