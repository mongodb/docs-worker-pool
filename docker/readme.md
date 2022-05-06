```shell
cd path/to/docs-worker-pool
docker build -t base-typescript -f docker/base-typescript/Dockerfile .
docker build -t ubuntu-python-node -f docker/ubuntu-python-node/Dockerfile .
docker build -t worker -f docker/worker/Dockerfile .
```