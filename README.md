# Docs Worker Pool

As part of the Docs Tools Next Generation Project, the Worker Pool seeks to make the build process for developers both easier and more scalable for developers. 

## Build and Run Docker Image
```
docker build --tag=workerpool .
docker run --env MONGO_ATLAS_USERNAME --env MONGO_ATLAS_PASSWORD --env ACCESS_KEY --env SECRET_KEY workerpool
```
* `MONGO_ATLAS_USERNAME` and `MONGO_ATLAS_PASSWORD` is username/password of atlas database
* `ACCESS_KEY` and `SECRET_KEY` are needed for uploading to S3 via [mut](https://github.com/mongodb/mut)

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