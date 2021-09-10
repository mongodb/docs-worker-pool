COMMIT_HASH=$(shell git rev-parse --short HEAD)
SNOOTY_ENV = $(shell printenv SNOOTY_ENV)
REGRESSION = $(shell printenv REGRESSION)
INTEGRATION_SEARCH_BUCKET=docs-search-indexes-integration
# "PATCH_ID" related shell commands to manage commitless builds
PATCH_FILE="myPatch.patch"
PATCH_ID=$(shell if test -f "${PATCH_FILE}"; then git patch-id < ${PATCH_FILE} | cut -b 1-7; fi)

PATCH_CLAUSE=$(shell if [ ! -z "${PATCH_ID}" ]; then echo --patch "${PATCH_ID}"; fi)

ifeq ($(SNOOTY_INTEGRATION),true)
	BUCKET_FLAG=-b ${INTEGRATION_SEARCH_BUCKET}
endif

get-project-name:
	@echo ${PROJECT};


ifndef DEDICATED_BUCKET
STAGING_URL="https://docs-mongodborg-staging.corp.mongodb.com"
STAGING_BUCKET=docs-mongodb-org-stg

ifeq ($(REGRESSION), true)
	PRODUCTION_URL="https://docs-mongodbcom-integration.corp.mongodb.com"
	PRODUCTION_BUCKET=docs-mongodb-org-intgr
else ifeq ($(SNOOTY_ENV), production) 
	PRODUCTION_URL="https://docs.mongodb.com"
	PRODUCTION_BUCKET=docs-mongodb-org-prd
else ifeq ($(SNOOTY_ENV), staging)
	PRODUCTION_URL="https://docs-mongodborg-staging.corp.mongodb.com"
	PRODUCTION_BUCKET=docs-mongodb-org-stg
else ifeq ($(SNOOTY_ENV), integration)
	PRODUCTION_URL="https://docs-mongodbcom-integration.corp.mongodb.com"
	PRODUCTION_BUCKET=docs-mongodb-org-intgr
endif

endif
	@echo "Hosted at ${PRODUCTION_URL}";

ifndef CUSTOM_NEXT_GEN_DEPLOY
next-gen-deploy:
	if [ -f config/redirects -a "${GIT_BRANCH}" = master ]; then mut-redirects config/redirects -o public/.htaccess; fi	
	yes | mut-publish public ${PRODUCTION_BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=${PRODUCTION_URL} --json --all-subdirectories ${ARGS};
	@echo "Hosted at ${PRODUCTION_URL}/${MUT_PREFIX}";
	if [ ${MANIFEST_PREFIX} ]; then $(MAKE) next-gen-deploy-search-index; fi
endif

ifndef PUSHLESS_DEPLOY_SHARED_DISABLED
next-gen-html:
	# snooty parse and then build-front-end
	@if [ -n "${PATCH_ID}" ]; then \
		echo ${SNOOTY_DB_PWD} | snooty build "${REPO_DIR}" "mongodb+srv://${SNOOTY_DB_USR}:@cluster0-ylwlz.mongodb.net/snooty?retryWrites=true" --commit "${COMMIT_HASH}" ${PATCH_CLAUSE}; \
		if [ $$? -eq 1 ]; then \
			exit 1; \
		else \
			exit 0; \
		fi \
	else \
		echo ${SNOOTY_DB_PWD} | snooty build "${REPO_DIR}" "mongodb+srv://${SNOOTY_DB_USR}:@cluster0-ylwlz.mongodb.net/snooty?retryWrites=true"; \
		if [ $$? -eq 1 ]; then \
			exit 1; \
		else \
			exit 0; \
		fi \
	fi
	rsync -az --exclude '.git' "${REPO_DIR}/../../snooty" "${REPO_DIR}" 
	cp ${REPO_DIR}/.env.production ${REPO_DIR}/snooty;
	cd snooty; \
	echo "GATSBY_SITE=${PROJECT}" >> .env.production; \
	if [ -n "${PATCH_ID}" ]; then \
		echo "COMMIT_HASH=${COMMIT_HASH}" >> .env.production && \
		echo "PATCH_ID=${PATCH_ID}" >> .env.production; \
	fi && \
	npm run build; \
	cp -r "${REPO_DIR}/snooty/public" ${REPO_DIR};

next-gen-stage: ## Host online for review
	# stagel local jobs \
	if [ -n "${PATCH_ID}" -a "${MUT_PREFIX}" = "${PROJECT}" ]; then \
		mut-publish public ${STAGING_BUCKET} --prefix="${COMMIT_HASH}/${PATCH_ID}/${MUT_PREFIX}" --stage ${ARGS}; \
		echo "Hosted at ${STAGING_URL}/${COMMIT_HASH}/${PATCH_ID}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/"; \
	# stagel commit jobs and regular git push jobs\
	else \
		mut-publish public ${STAGING_BUCKET} --prefix="${MUT_PREFIX}" --stage ${ARGS}; \
		echo "Hosted at ${STAGING_URL}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/"; \
	fi
endif

## Update the search index for this branch
## HACK-Y WORKAROUNDS:
## docs && cloud-docs && cloudgov have own search indexes to rename their manifests because of a bug in the workerpool code
## Landing doesn't have search at all.
ifndef CUSTOM_SEARCH_INDEX
next-gen-deploy-search-index:
	@echo "Building search index"
	mut-index upload public -b ${PRODUCTION_BUCKET} -o ${MANIFEST_PREFIX}.json -u ${PRODUCTION_URL}/${MUT_PREFIX} -s ${GLOBAL_SEARCH_FLAG} $(BUCKET_FLAG)
endif
