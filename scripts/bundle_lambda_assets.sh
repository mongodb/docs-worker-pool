#!/usr/bin/env bash
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )

cd "$parent_path"
cd ../

cp -a config/. build/config
cp -a api/config/. build/api/config
zip -r build.zip build