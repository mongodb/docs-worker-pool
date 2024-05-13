# Build the Typescript app
FROM node:18.16.0-alpine as ts-compiler
WORKDIR /home/docsworker-xlarge
COPY  config config/
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm ci --legacy-peer-deps
COPY . ./
RUN npm run build

# install persistence module
RUN cd ./modules/persistence \
    && npm ci --legacy-peer-deps \
    && npm run build

# Build modules
# OAS Page Builder
RUN cd ./modules/oas-page-builder \
    && npm ci --legacy-peer-deps \
    && npm run build

# where repo work will happen
FROM ubuntu:20.04
ARG WORK_DIRECTORY=/home/docsworker-xlarge
ARG SNOOTY_PARSER_VERSION=0.16.6
ARG SNOOTY_FRONTEND_VERSION=0.16.13
ARG MUT_VERSION=0.11.2
ARG REDOC_CLI_VERSION=1.2.3
ARG NPM_BASE_64_AUTH
ARG NPM_EMAIL
ENV DEBIAN_FRONTEND=noninteractive


# helper libraries for docs builds
RUN apt-get update && apt-get install -y vim git unzip rsync curl


ENV PATH="${PATH}:/opt/snooty:/opt/mut:/home/docsworker-xlarge/.local/bin"

# get node 18
# https://gist.github.com/RinatMullayanov/89687a102e696b1d4cab
RUN apt-get install --yes curl
RUN curl --location https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# use npm 8.*
RUN npm install -g npm@8

# install snooty parser
RUN curl -L -o snooty-parser.zip https://github.com/mongodb/snooty-parser/releases/download/v${SNOOTY_PARSER_VERSION}/snooty-v${SNOOTY_PARSER_VERSION}-linux_x86_64.zip \
    && unzip -d /opt/ snooty-parser.zip

# install mut
RUN curl -L -o mut.zip https://github.com/mongodb/mut/releases/download/v${MUT_VERSION}/mut-v${MUT_VERSION}-linux_x86_64.zip \
    && unzip -d /opt/ mut.zip

# setup user and root directory
RUN useradd -ms /bin/bash docsworker-xlarge
RUN chmod 755 -R ${WORK_DIRECTORY}
RUN chown -Rv docsworker-xlarge ${WORK_DIRECTORY}
USER docsworker-xlarge

WORKDIR ${WORK_DIRECTORY}

# Get Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

RUN chmod -R 777 ${WORK_DIRECTORY}/.cargo/bin

ENV PATH="${WORK_DIRECTORY}/.cargo/bin:${PATH}"


# get shared.mk
RUN curl https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/shared.mk -o shared.mk

# install snooty frontend and docs-tools
RUN git clone -b v${SNOOTY_FRONTEND_VERSION} --depth 1 https://github.com/mongodb/snooty.git       \
    && cd snooty                                                                                   \
    # Need to remove omit dev as the filter functionality for the frontend depends on a dev dependency.
    && npm ci --legacy-peer-deps                                                       \
    && git clone --depth 1 https://github.com/mongodb/docs-tools.git                               \
    && mkdir -p ./static/images                                                                    \
    && mv ./docs-tools/themes/mongodb/static ./static/docs-tools                                   \
    && mv ./docs-tools/themes/guides/static/images/bg-accent.svg ./static/docs-tools/images/bg-accent.svg \
    && cd component-factory-transformer \
    && cargo build \
    && rustup target add wasm32-wasi \
    && npm run prepublishOnly                                                        


# install redoc fork
RUN git clone -b @dop/redoc-cli@${REDOC_CLI_VERSION} --depth 1 https://github.com/mongodb-forks/redoc.git redoc \
    # Install dependencies for Redoc CLI
    && cd redoc/ \
    && npm ci --prefix cli/ --omit=dev

COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/package*.json ./
COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/config config/
COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/build ./
RUN npm install

# Persistence module copy
# Create directory and add permissions to allow node module installation
RUN mkdir -p modules/persistence && chmod 755 modules/persistence
COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/modules/persistence/package*.json ./modules/persistence/
COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/modules/persistence/dist ./modules/persistence/
ENV PERSISTENCE_MODULE_PATH=${WORK_DIRECTORY}/modules/persistence/index.js
RUN cd ./modules/persistence/ && ls && npm ci --legacy-peer-deps

# OAS Page Builder module copy
# Create directory and add permissions to allow node module installation
RUN mkdir -p modules/oas-page-builder && chmod 755 modules/oas-page-builder
COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/modules/oas-page-builder/package*.json ./modules/oas-page-builder/
COPY --from=ts-compiler --chown=docsworker-xlarge /home/docsworker-xlarge/modules/oas-page-builder/dist ./modules/oas-page-builder/
RUN cd ./modules/oas-page-builder/ && npm ci --legacy-peer-deps

# Needed for OAS Page Builder module in shared.mk
ENV REDOC_PATH=${WORK_DIRECTORY}/redoc/cli/index.js
ENV OAS_MODULE_PATH=${WORK_DIRECTORY}/modules/oas-page-builder/index.js

RUN mkdir repos && chmod 755 repos
EXPOSE 3000
CMD ["node", "app.js"]
