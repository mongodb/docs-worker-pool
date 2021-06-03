COMMIT_HASH=$(shell git rev-parse --short HEAD)
INTEGRATION_SEARCH_BUCKET=docs-search-indexes-integration

ifeq ($(SNOOTY_INTEGRATION),true)
	BUCKET_FLAG=-b ${INTEGRATION_SEARCH_BUCKET}
endif

get-project-name:
	@echo ${PROJECT};

ifndef CUSTOM_NEXT_GEN_DEPLOY
next-gen-deploy:
	if [ -f config/redirects -a "${GIT_BRANCH}" = master ]; then mut-redirects config/redirects -o public/.htaccess; fi	
	yes | mut-publish public ${PRODUCTION_BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=${PRODUCTION_URL} --json --all-subdirectories ${ARGS};
	@echo "Hosted at ${PRODUCTION_URL}/${MUT_PREFIX}";
	if [ ${MANIFEST_PREFIX} ]; then $(MAKE) next-gen-deploy-search-index; fi
endif

## Update the search index for this branch
next-gen-deploy-search-index:
	@echo "Building search index"
	mut-index upload public -o ${MANIFEST_PREFIX}.json -u ${PRODUCTION_URL}/${MUT_PREFIX} -s ${GLOBAL_SEARCH_FLAG} $(BUCKET_FLAG)