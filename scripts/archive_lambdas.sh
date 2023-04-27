#!/usr/bin/env bash
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )

cd "$parent_path"
cd ../

# add additional assets for lambda code
cp -a config/. build/config
cp -a api/config/. build/api/config
cp -a node_modules build

zip -r build.zip build