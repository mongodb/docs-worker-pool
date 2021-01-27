USER=$(shell whoami)

SNOOTY_DB_USR = $(shell printenv MONGO_ATLAS_USERNAME)
SNOOTY_DB_PWD = $(shell printenv MONGO_ATLAS_PASSWORD)

get-build-dependencies: 
	@curl https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/publishedbranches/docs-node.yaml > ${REPO_DIR}/published-branches.yaml


ifndef CUSTOM_NEXT_GEN_HTML
next-gen-html:
	# snooty parse and then build-front-end
	@echo ${SNOOTY_DB_PWD} | snooty build "${REPO_DIR}" "mongodb+srv://${SNOOTY_DB_USR}:@cluster0-ylwlz.mongodb.net/snooty?retryWrites=true" --commit "${COMMIT_HASH}"; \
	if [ $$? -eq 1 ]; then \
		exit 1; \
	else \
		exit 0; \
	fi
	rsync -az --exclude '.git' ${REPO_DIR}/../../snooty ${REPO_DIR};
	cp ${REPO_DIR}/.env.production ${REPO_DIR}/snooty; 
	cd snooty; \
	echo "GATSBY_SITE=${PROJECT}" >> .env.production; \
	echo "COMMIT_HASH=${COMMIT_HASH}" >> .env.production; \
	npm run build; \
	cp -r "${REPO_DIR}/snooty/public" ${REPO_DIR};
endif


next-gen-stage: ## Host online for review
	mut-publish public ${STAGING_BUCKET} --prefix="${COMMIT_HASH}/${MUT_PREFIX}" --stage ${ARGS};
	echo "Hosted at ${STAGING_URL}/${COMMIT_HASH}/${MUT_PREFIX}/${USER}/${GIT_BRANCH}/";

html: ## Builds this branch's HTML under build/<branch>/html
	giza make html

next-gen-deploy:	
	if [ ${GIT_BRANCH} = master ]; then mut-redirects config/redirects -o public/.htaccess; fi
	yes | mut-publish public ${PRODUCTION_BUCKET} --prefix="${MUT_PREFIX}" --deploy --deployed-url-prefix=PRODUCTION_URL --json --all-subdirectories ${ARGS};
	@echo "Hosted at ${PRODUCTION_URL}/${MUT_PREFIX}";
	$(MAKE) next-gen-deploy-search-index

next-gen-deploy-search-index: ## Update the search index for this branch
	@echo "Building search index"
	mut-index upload public -o ${MANIFEST_PREFIX}.json -u ${PRODUCTION_URL}/${MUT_PREFIX} -s ${GLOBAL_SEARCH_FLAG}
