# Docs Worker Pool

As part of the Docs Tools Next Generation Project, the Worker Pool seeks to make the build process for developers both easier and more scalable for developers. 

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
	workerpool
```
* `MONGO_ATLAS_USERNAME` and `MONGO_ATLAS_PASSWORD` is username/password of atlas database
* `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are needed for uploading to S3 via [mut](https://github.com/mongodb/mut)
* `GITHUB_BOT_USERNAME` and `GITHUB_BOT_PASSWORD` are needed so builder can access private repos

If you are running a local version of the docker image for testing, we have a separate staging environment setup. Add the following env variables to the `docker run` command:
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
