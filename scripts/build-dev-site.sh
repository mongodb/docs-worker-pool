curl -L -o snooty-parser.zip https://github.com/mongodb/snooty-parser/releases/download/v0.16.7/snooty-v0.16.7-darwin_arm64.zip
unzip -d ./snooty-parser snooty-parser.zip

curl https://raw.githubusercontent.com/mongodb/docs-worker-pool/netlify-poc/scripts/build-site.sh -o build-site.sh 
sh build-site.sh