INTEGRATION_SEARCH_BUCKET=docs-search-indexes-integration

# "PATCH_ID" related shell commands to manage commitless builds
PATCH_FILE="myPatch.patch"
PATCH_ID=$(shell if test -f "${PATCH_FILE}"; then git patch-id < ${PATCH_FILE} | cut -b 1-7; fi)
PATCH_CLAUSE=$(shell if [ ! -z "${PATCH_ID}" ]; then echo --patch "${PATCH_ID}"; fi)

GITHUB_USER_NAME=$(shell git config --global user.name)
GIT_BRANCH=$(shell git rev-parse --abbrev-ref HEAD)

ifeq ($(SNOOTY_INTEGRATION),true)
	BUCKET_FLAG=-b ${INTEGRATION_SEARCH_BUCKET}
endif

get-project-name:
	@echo ${PROJECT};

## Update the search index for this branch
next-gen-deploy-search-index:
	@echo "Building search index"
	mut-index upload public -o ${MANIFEST_PREFIX}.json -u ${PRODUCTION_URL}/${MUT_PREFIX} -s ${GLOBAL_SEARCH_FLAG} $(BUCKET_FLAG)

ifndef CUSTOM_NEXT_GEN_HTML
next-gen-html:
	# snooty parse and then build-front-end
	echo 'snooty build "${REPO_DIR}" "mongodb+srv://${SNOOTY_DB_USR}:@cluster0-ylwlz.mongodb.net/snooty?retryWrites=true" --commit "${COMMIT_HASH}" ${PATCH_CLAUSE}';
	rsync -az --exclude '.git' "${REPO_DIR}/../../snooty" "${REPO_DIR}" 
	cp ${REPO_DIR}/.env.production ${REPO_DIR}/snooty;
	cd snooty; \
	echo "GATSBY_SITE=${PROJECT}" >> .env.production; \
	echo "COMMIT_HASH=${COMMIT_HASH}" >> .env.production; \
	echo "GITHUB_USERNAME=${GITHUB_USER_NAME}" >> .env.production; \
	if [ -n "${PATCH_ID}" ]; then \
		echo "PATCH_ID=${PATCH_ID}" >> .env.production; \
	fi && \
	npm run build; \
	cp -r "${REPO_DIR}/snooty/public" ${REPO_DIR};
endif

ifndef CUSTOM_NEXT_GEN_STAGE
next-gen-stage: ## Host online for review
	mut-publish public ${STAGING_BUCKET} --prefix="${MUT_PREFIX}/${GITHUB_USER_NAME}" --stage ${ARGS}; \
	echo "Hosted at ${STAGING_URL}/${MUT_PREFIX}/${GITHUB_USER_NAME}/${GIT_BRANCH}/"; 
endif