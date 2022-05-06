```shell
cd path/to/docs-worker-pool
docker build -t base-typescript -f docker/base-typescript/Dockerfile .
docker build -t ubuntu-python-node -f docker/ubuntu-python-node/Dockerfile .
docker build -t worker -f docker/worker/Dockerfile \
  --build-arg NPM_CONFIG__AUTH --build-arg NPM_CONFIG_EMAIL --build-arg NPM_CONFIG_REGISTRY .
# docker build -t test -f docker/test/Dockerfile .
```