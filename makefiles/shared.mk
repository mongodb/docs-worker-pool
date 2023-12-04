COMMIT_HASH=$(shell git rev-parse --short HEAD)
SNOOTY_ENV = $(shell printenv SNOOTY_ENV)
REGRESSION = $(shell printenv REGRESSION)
BUCKET = $(shell printenv BUCKET)
URL = $(shell printenv URL)

# Defaults to an empty string if NO_CACHING is not provided as an arg.
# If no value is provided for NO_CACHING, then we do want to use the cache when parsing.
NO_CACHING ?= 
# "PATCH_ID" related shell commands to manage commitless builds
PATCH_FILE="myPatch.patch"
PATCH_ID=$(shell if test -f "${PATCH_FILE}"; then git patch-id < ${PATCH_FILE} | cut -b 1-7; fi)

PATCH_CLAUSE=$(shell if [ ! -z "${PATCH_ID}" ]; then echo --patch "${PATCH_ID}"; fi)

BUNDLE_PATH=${REPO_DIR}/bundle.zip
RSTSPEC_FLAG=--rstspec=https://raw.githubusercontent.com/mongodb/snooty-parser/latest/snooty/rstspec.toml

ifeq ($(SNOOTY_INTEGRATION),true)
	BUCKET_FLAG=-b ${INTEGRATION_SEARCH_BUCKET}
endif



get-project-name:
	@echo ${PROJECT};


ifndef CUSTOM_NEXT_GEN_DEPLOY # def'd for docs-mongodb-internal* and docs-404 only
next-gen-deploy:
	if [ -f config/redirects ] && [ "${GIT_BRANCH}" = master -o "${GIT_BRANCH}" = main ]; then mut-redirects config/redirects -o public/.htaccess; fi
	yes | mut-publish public ${BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=${URL} --json --all-subdirectories ${ARGS};
	@echo "Hosted at ${URL}/${MUT_PREFIX}";
endif

ifndef PUSHLESS_DEPLOY_SHARED_DISABLED
next-gen-parse:
	# snooty parse -- separated from front-end to support index gen
	if [ -n "${PATCH_ID}" ]; then \
		snooty build "${REPO_DIR}" --output "${BUNDLE_PATH}" --commit "${COMMIT_HASH}" ${PATCH_CLAUSE} ${RSTSPEC_FLAG} ${NO_CACHING}; \
		if [ $$? -eq 1 ]; then \
			exit 1; \
		else \
			exit 0; \
		fi \
	else \
		snooty build "${REPO_DIR}" --output "${BUNDLE_PATH}" ${RSTSPEC_FLAG} ${NO_CACHING}; \
		if [ $$? -eq 1 ]; then \
			exit 1; \
		else \
			exit 0; \
		fi \
	fi

# Set Github user to docs-builder-bot if empty
ifeq ($(GH_USER),)
GH_USER_ARG=docs-builder-bot
else
GH_USER_ARG=${GH_USER}
endif

ifneq (,$(findstring docs-monorepo,$(REPO_DIR)))
    # Found
		PATH_TO_SNOOTY=${REPO_DIR}/../../../snooty
else
    # Not found
		PATH_TO_SNOOTY=${REPO_DIR}/../../snooty
endif

next-gen-html:
	# build-front-end after running parse commands
	rsync -az --exclude '.git' "${PATH_TO_SNOOTY}" "${REPO_DIR}"
	cp ${REPO_DIR}/.env.production ${REPO_DIR}/snooty;
	cd snooty; \
	echo "GATSBY_SITE=${PROJECT}" >> .env.production; \
	if [ -n "${PATCH_ID}" ]; then \
		echo "COMMIT_HASH=${COMMIT_HASH}" >> .env.production && \
		echo "PATCH_ID=${PATCH_ID}" >> .env.production; \
	fi && \
	GATSBY_MANIFEST_PATH="${BUNDLE_PATH}" npm run build; \
	cp -r "${REPO_DIR}/snooty/public" ${REPO_DIR};

next-gen-stage: ## Host online for review
	# stagel local jobs
	if [ -n "${PATCH_ID}" -a "${MUT_PREFIX}" = "${PROJECT}" ]; then \
		mut-publish public ${BUCKET} --prefix="${COMMIT_HASH}/${PATCH_ID}/${MUT_PREFIX}" --stage ${ARGS}; \
		echo "Hosted at ${URL}/${COMMIT_HASH}/${PATCH_ID}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/"; \
	# stagel commit jobs and regular git push jobs\
	else \
		mut-publish public ${BUCKET} --prefix="${MUT_PREFIX}" --stage ${ARGS}; \
		echo "Hosted at ${URL}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/"; \
	fi
endif

# Set --site-url for oas-module build command based on availability of MUT_PREFIX
ifeq ($(MUT_PREFIX),)
SITE_URL=${URL}/${PROJECT}/${USER}/${BRANCH_NAME}
else
SITE_URL=${URL}/${MUT_PREFIX}
endif

persistence-module:
	# persistence module - add bundle zip to Atlas documents
	node --unhandled-rejections=strict ${PERSISTENCE_MODULE_PATH} --path ${BUNDLE_PATH} --githubUser ${GH_USER_ARG} --jobId ${JOB_ID}
	if [ $$? -eq 1 ]; then \
		exit 1; \
	else \
		exit 0; \
	fi

# Intended to be called by the autobuilder as a build command after frontend build, but before mut upload
# Staging: https://github.com/mongodb/docs-worker-pool/blob/42bd36b1f52e49c646a79474c12d299f33d774cb/src/job/stagingJobHandler.ts#L57
# Production: https://github.com/mongodb/docs-worker-pool/blob/1a482242fa6f1463abb059884cddb2c56ba9fad9/src/job/productionJobHandler.ts#L68
oas-page-build:
	@echo "oas page build - MUT_PREFIX = ${MUT_PREFIX}, Project/User/Branch = ${PROJECT}/${USER}/${BRANCH_NAME}"
	node ${OAS_MODULE_PATH} --bundle ${BUNDLE_PATH} --output ${REPO_DIR}/public --redoc ${REDOC_PATH} --repo ${REPO_DIR} --site-url ${SITE_URL}
