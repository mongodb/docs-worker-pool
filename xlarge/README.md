# xlarge deployment manager 

The xlarge deployment manager is a docker build automation script that triggers when code is pushed to the docs-worker-pool.

## install docker

The method to install docker depends on the environment in which you are deploying the Snooty autobuilder.

On Ubuntu ec2, use

```
sudo apt-get install -y docker
```

## install node

```
sudo apt-get install node
```

## create your rundocker.sh

build.sh requires you to provide a script to instantiate your workerpool container(s).

Your script should contain the code below.

Note that there are environment variables required -- in this instance XLARGE should be "true".

```
docker run \
	--env MONGO_ATLAS_USERNAME \
	--env MONGO_ATLAS_PASSWORD \
	--env AWS_ACCESS_KEY_ID \
	--env AWS_SECRET_ACCESS_KEY \
	--env GITHUB_BOT_USERNAME \
	--env GITHUB_BOT_PASSWORD \
        --env DB_NAME \
        --env XLARGE \
	workerpool
```
* `MONGO_ATLAS_USERNAME` and `MONGO_ATLAS_PASSWORD` is username/password of atlas database
* `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are needed for uploading to S3 via [mut](https://github.com/mongodb/mut)
* `GITHUB_BOT_USERNAME` and `GITHUB_BOT_PASSWORD` are needed so builder can access private repos

If you are running a local version of the docker image for testing, we have a separate staging environment setup. Add the following env variables to the `docker run` command:
```
--env DB_NAME
```

## run buildtrigger.js

The buildtrigger.js node script will listen on port 8080 for incoming github push notifications, authenticating the messages and then running build.sh. build.sh will install your Docker image and instantiate rundocker.sh

To run:

``` 
sudo node ./buildtrigger.js > trigger.log &
```

## logs

The most recent build is logged in logs/lastbuild.log. The previous 5 build events are captured in the same directory in archived logfiles.

