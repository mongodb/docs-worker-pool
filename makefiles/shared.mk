INTEGRATION_SEARCH_BUCKET=docs-search-indexes-integration

ifeq ($(SNOOTY_INTEGRATION),true)
	BUCKET_FLAG=-b ${INTEGRATION_SEARCH_BUCKET}
endif

get-project-name:
	@echo ${PROJECT};

## Update the search index for this branch
next-gen-deploy-search-index:
	@echo "Building search index"
	mut-index upload public -o ${MANIFEST_PREFIX}.json -u ${PRODUCTION_URL}/${MUT_PREFIX} -s ${GLOBAL_SEARCH_FLAG} $(BUCKET_FLAG)

