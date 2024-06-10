
if [ ! -d "snooty-parser" ]; then
  echo "snooty parser not installed, downloading..."
  curl -L -o snooty-parser.zip https://github.com/mongodb/snooty-parser/releases/download/v0.16.6/snooty-v0.16.6-linux_x86_64.zip
  unzip -d ./snooty-parser snooty-parser.zip
  chmod +x ./snooty-parser/snooty
fi

echo "Running parser..."
./snooty-parser/snooty/snooty build . --output=./bundle.zip
echo "Parser complete"

if [ ! -d "snooty" ]; then
  echo "snooty frontend not installed, downloading"
  git clone -b netlify-poc --depth 1 https://github.com/mongodb/snooty.git 
  echo GATSBY_MANIFEST_PATH=$(pwd)/bundle.zip >> ./snooty/.env.production
  cd snooty
  npm ci --legacy-peer-deps
  git clone --depth 1 https://github.com/mongodb/docs-tools.git ./snooty/docs-tools
  mkdir -p ./snooty/static/images
  mv ./snooty/docs-tools/themes/mongodb/static ./static/docs-tools
  mv ./snooty/docs-tools/themes/guides/static/images/bg-accent.svg ./static/docs-tools/images/bg-accent.svg

  echo "snooty frontend installed"
fi

ls -al

cd snooty && npm run build
