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
Development in this repository can be done via forks or branches. Currently, we support an `integration` and `master` branch, in addition to a `meta` branch. In general, the development workflow is to open pull requests against `integration`, and to promote `integration` to `master` after testing prior to a release.

In general, the git workflow within this repository loosely follows https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow .

### Meta
`Meta` contains various makefiles and .yaml files used for configuration.
Changes or additions to/of makefiles and .yaml for publishing purposes should be performed against this branch.
There is no general requirement to keep `Meta` up to date with `Master` or `Integration`.

### Integration
`Integration` is treated as a running feature branch that should **always** remain up to date with `master`

### Master
`Master` is treated as our production state branch. In general, pull requests to master should be opened only from integration or a hot-fix feature branch.
If a change is merged into `Master` that is not present in `Integration`, in general, that change should be merged as well from said branch or fork into integration. 

## Releasing
docs-worker-pool contains various triggers for release to higher environments. Currently, the repository supports an integration environment (reflecting the state of the integration branch) and a production environment (reflecting the state of the most recent release tag). 

### Integration
 - Merge a pull request or otherwise push a commit to the integration branch. 
 - Verify that the deploy-integration-ec2 workflow has executed successfully.

### Production
 - Merge outstanding changes within `integration` to `master`.
 - Create release tags.
 - Verify that the deploy-production-ec2 workflow executed successfully for both job runs across both production instances.
