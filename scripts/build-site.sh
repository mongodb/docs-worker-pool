ls -l ./snooty-parser
chmod +x ./snooty-parser/snooty
./snooty-parser/snooty/snooty build . --output=./bundle.zip

if [ ! -d "snooty" ]; then
  echo "snooty not cloned, downloading"
  
  git clone -b netlify-poc --depth 1 https://github.com/mongodb/snooty.git 
  cd snooty
  npm ci --legacy-peer-deps
  git clone --depth 1 https://github.com/mongodb/docs-tools.git ./snooty/docs-tools
  mkdir -p ./snooty/static/images
  mv ./snooty/docs-tools/themes/mongodb/static ./static/docs-tools
  mv ./snooty/docs-tools/themes/guides/static/images/bg-accent.svg ./static/docs-tools/images/bg-accent.svg
fi

echo GATSBY_MANIFEST_PATH=$(pwd)/bundle.zip >> ./snooty/.env.production

cd snooty && npm run build

snooty create-cache .