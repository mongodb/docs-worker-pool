# Docs Worker Pool

As part of the Docs Tools Next Generation Project, the Docs Worker Pool seeks to make the build process for developers both easier and more scalable for developers. 

## Build and Run Docker Image
```
docker build --tag=workerpool .
docker run \
	--env MONGO_ATLAS_USERNAME \
	--env MONGO_ATLAS_PASSWORD \
	--env AWS_ACCESS_KEY_ID \
	--env AWS_SECRET_ACCESS_KEY \
	--env GITHUB_BOT_USERNAME \
	--env GITHUB_BOT_PASSWORD \
	--env DB_NAME \
	--env XLARGE \
	--env SNOOTY_ENV \
	--env FASTLY_TOKEN \
	--env FASTLY_DOCHUB_MAP \
	--env FASTLY_SERVICE_ID \
	workerpool
```
* `MONGO_ATLAS_USERNAME` and `MONGO_ATLAS_PASSWORD` is username/password of atlas database
* `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are needed for uploading to S3 via [mut](https://github.com/mongodb/mut)
* `GITHUB_BOT_USERNAME` and `GITHUB_BOT_PASSWORD` are needed so builder can access private repos
* `DB_NAME` allows the indication of a pool database (pool, pool_test)
* `XLARGE` true or false indicates whether this instance will run on an XLARGE server or not
* `SNOOTY_ENV` indicates whether the build environment is stage, prod, or dev
* `FASTLY_TOKEN` is needed for connecting to the Fastly edge dictionary
* `FASTLY_DOCHUB_MAP` is the id of the redirect map that we publish dochub links to
* `FASTLY_SERVICE_ID` is the id of the service used for dochub

If you are running a local version of the docker image for testing, we have a separate staging environment setup. Testing in this environment is automated through the "stage" branch. Add the following env variables to the `docker run` command:
```
--env DB_NAME
```

## Run Tests
```
cd worker 
npm install --dev
npm test  // runs ~ jest --detectOpenHandles --coverage
```

## Run Linter
```
cd worker 
npm install --dev
./node_modules/.bin/eslint .
```

See the [spec doc](https://docs.google.com/document/d/1XZOuuGmozcLQRSDitx0UWhZzJaS4opR1JVwZqDp-N4g/edit?usp=sharing) for more details.

## Branches
Development in this repository can be done via forks or branches. Currently, we support a `master` branch and `meta` branch. In general, the development workflow is to open pull requests against `master`, and to test `master` prior to creating new tags for a release.

In general, the git workflow within this repository loosely follows https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow .

### Meta
`meta` contains various makefiles and .yaml files used for configuration.
Changes or additions to/of makefiles and .yaml for publishing purposes should be performed against this branch.
There is no general requirement to keep `meta` up to date with `master` or `integration`.

### Master
`master` is treated as a running pre-production feature branch. Changes should not go into master until properly tested for regressions in an acceptance environment. It is an expectation that hotfixes may have to occur on occasion - on such an occasion, a feature branch should be made from the commit hash of the last release tag, and not from the head of master. Master may contain changes that have yet to be fully tested for a production release.

### Release Tags
Each release tag represents a presumptive stable release - with the most recent release tag representing the current state of our production environment.

## Release Process
docs-worker-pool contains various triggers for release to higher environments. Currently, the repository supports an integration environment (reflecting the state of the master branch) and a production environment (reflecting the state of the most recent release tag). 

### Integration Environment
 - Merge a pull request or otherwise push a commit to `master` branch. 
 - Verify that the deploy-integration-ec2 workflow has executed successfully.

### Production Environment
 - Rebase `master` with `integration` and push the latest changes, or merge a pull request to `master` if performing a hotfix.
 - If you don't have push access, open an issue or otherwise contact a contributor with administrator priveliges. 
 - Create release tags. We currently follow [semver](https://semver.org/) standards.
 - Verify that the deploy-production-ec2 workflow executed successfully for both job runs across both production instances.
