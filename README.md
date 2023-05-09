# Docs Worker Pool

As part of the Docs Tools Next Generation Project, the Docs Worker Pool seeks to make the build process for developers
both easier and more scalable for developers.

The Docs Worker Pool operates on ECS Fargate. The serverless framework and cloudformation are used to automate
infrastructure provisioning and management. Going forward, any new buckets should be specified in
`infrastructure/ecs-main/buckets.yml`

## To Add new properties

All our properties are managed in parameter store and pulled by serverless framework during deploy time and pushed into the Task environment as part of task definition.

To add a new property:

- Add property to parameter store for all environments (`stg`/`prd`) by following the convention as other properties
- Go to `infrastructure/ecs-main/serverless.yml` `custom` section
- Define the variable pointing to the right parameter store path
- Go to `infrastructure/ecs-main/ecs-service.yml` `TaskDefinition` section
- Add the new property to the `ContainerDefinitions`/`Environment` section

## Build and Run Docker Image for local testing

The npm build args are required for the portion of the dockerfile that installs the [snooty-frontend]. `NPM_CONFIG__AUTH`
and `NPM_CONFIG_EMAIL` are environment variables available in our working directory. `NPM_CONFIG_{OPTION}` environment
variables can actually be used instead of the `~/.npmrc` file. The reason we need the build args to be `NPM_BASE_64_AUTH`
and `NPM_EMAIL` is because that's what's expected in the `.npmrc` within [snooty-frontend].

```shell
docker build --tag=workerpool --build-arg NPM_BASE_64_AUTH=${NPM_CONFIG__AUTH} --build-arg NPM_EMAIL=${NPM_CONFIG_EMAIL} .
```

```shell
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

- `MONGO_ATLAS_USERNAME` and `MONGO_ATLAS_PASSWORD` is username/password of atlas database
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are needed for uploading to S3 via [mut](https://github.com/mongodb/mut)
- `GITHUB_BOT_USERNAME` and `GITHUB_BOT_PASSWORD` are needed so builder can access private repos
- `DB_NAME` allows the indication of a pool database (pool, pool_test)
- `XLARGE` true or false indicates whether this instance will run on an XLARGE server or not
- `SNOOTY_ENV` indicates whether the build environment is stage, prod, or dev
- `FASTLY_TOKEN` is needed for connecting to the Fastly edge dictionary
- `FASTLY_DOCHUB_MAP` is the id of the redirect map that we publish dochub links to
- `FASTLY_SERVICE_ID` is the id of the service used for dochub

If you are running a local version of the docker image for testing, we have a separate staging environment setup. Testing in this environment is automated through the "stage" branch. Add the following env variables to the `docker run` command:

```
--env DB_NAME
```

## Run Tests

```
npm install --dev
npm test  // runs ~ jest --detectOpenHandles --coverage
```

## Run Linter

```
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

- Create release tags. We currently follow [semver](https://semver.org/) standards.
- If you don't have push access, open an issue or otherwise contact a contributor with administrator privileges.
- Verify that the deploy-production-ec2 workflow executed successfully for both job runs across both production instances.

### Serverless Development

#### Documentation

- [getting started][serverless]

#### Installation

```shell
npm install -g serverless
```

#### AWS Config

The serverless framework looks for credentials in `~/.aws/credentials`. So we need to set a profile there in addition to
`aws sso login`.

```text
[docs-sls-admin]
aws_access_key_id=REDACTED
aws_secret_access_key=REDACTED
```

#### Deploy Single Function

```shell
sls deploy function --stage dev --function {FunctionName}
```

[serverless]: https://www.serverless.com/framework/docs/getting-started
[snooty-frontend]: https://github.com/mongodb/snooty
