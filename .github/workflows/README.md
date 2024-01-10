# Docs Worker Pool Workflows

This README describes the various workflows defined for the docs-worker-pool repository.

## Feature Branch Deploys

The feature branch deploy process occurs whenever a developer opens a pull request. It consists of three separate workflows:

1. `deploy-feature-branch.yml` - Creates the initial infrastructure when a PR is opened, this includes draft PRs
2. `update-feature-branch.yml` - Ran whenever a commit is made to the branch for the PR, and conditionally deploys each stack depending on changes made
3. `clean-feature-branch.yml` - Ran whenever a PR is merged or closed; deletes all of the infrastructure for the feature branch

### Bugs

Right now, there is a small bug with the `update-feature-branch.yml` workflow. This workflow conditionally deploys the various stacks depending on what files have changed from a commit. The issue is that the custom filter action compares the PR branch to master for every workflow run. This means that if you make a change to `src/app.ts` in the first commit, but only make changes to files in the `api/` directory in subsequent commits, it will still run the deploy for the worker.
