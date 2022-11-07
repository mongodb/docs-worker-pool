COMMIT_HASH=$(shell git rev-parse --short HEAD)
SNOOTY_ENV = $(shell printenv SNOOTY_ENV)
REGRESSION = $(shell printenv REGRESSION)
BUCKET = $(shell printenv BUCKET)
URL = $(shell printenv URL)

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


ifndef CUSTOM_NEXT_GEN_DEPLOY
next-gen-deploy:
	if [ -f config/redirects -a "${GIT_BRANCH}" = master ]; then mut-redirects config/redirects -o public/.htaccess; fi
	yes | mut-publish public ${BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=${URL} --json --all-subdirectories ${ARGS};
	@echo "Hosted at ${URL}/${MUT_PREFIX}";
endif

ifndef PUSHLESS_DEPLOY_SHARED_DISABLED
next-gen-html:
	# snooty parse and then build-front-end
	if [ -n "${PATCH_ID}" ]; then \
		snooty build "${REPO_DIR}" --output "${BUNDLE_PATH}" --commit "${COMMIT_HASH}" ${PATCH_CLAUSE} ${RSTSPEC_FLAG}; \
		if [ $$? -eq 1 ]; then \
			exit 1; \
		else \
			exit 0; \
		fi \
	else \
		snooty build "${REPO_DIR}" --output "${BUNDLE_PATH}" ${RSTSPEC_FLAG}; \
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

