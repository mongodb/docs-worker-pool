# Build the Typescript app
FROM node:14-alpine3.10 as ts-compiler
WORKDIR /home/docsworker-xlarge
COPY  config config/
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install
COPY . ./
RUN npm run build

# install persistence module
RUN cd ./modules/persistence \
    && npm install \
    && npm run build

# where repo work will happen
FROM ubuntu:20.04
ARG SNOOTY_PARSER_VERSION=0.13.13
ARG SNOOTY_FRONTEND_VERSION=0.13.34
ARG FLIT_VERSION=3.0.0
ARG NPM_BASE_64_AUTH
ARG NPM_EMAIL
ENV DEBIAN_FRONTEND=noninteractive
ENV FLIT_ROOT_INSTALL=1

# install legacy build environment for docs
RUN apt-get -o Acquire::Check-Valid-Until=false update
RUN apt-get -y install libpython2.7-dev python2.7 git rsync
RUN apt-get -y install curl
RUN curl https://bootstrap.pypa.io/pip/2.7/get-pip.py --output get-pip.py
RUN python2.7 get-pip.py
RUN pip install requests virtualenv virtualenvwrapper py-dateutil
RUN python2.7 -m pip install python-dateutil 
RUN virtualenv /venv
RUN /venv/bin/pip install --upgrade --force setuptools
RUN /venv/bin/pip install -r https://raw.githubusercontent.com/mongodb/docs-tools/master/giza/requirements.txt

# helper libraries for docs builds
RUN apt-get update && apt-get install -y python3 python3-dev python3-pip
RUN apt-get -y install vim
RUN apt-get -y install git pkg-config libxml2-dev
RUN python3 -m pip install https://github.com/mongodb/mut/releases/download/v0.10.2/mut-0.10.2-py3-none-any.whl


ENV PATH="${PATH}:/home/docsworker-xlarge/.local/bin:/usr/local/lib/python2.7/dist-packages/virtualenv/bin"

# get node 14
# https://gist.github.com/RinatMullayanov/89687a102e696b1d4cab
RUN apt-get install --yes curl
RUN curl --location https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# use npm 7.*
RUN npm install npm@7

# setup user and root directory
RUN useradd -ms /bin/bash docsworker-xlarge
RUN npm -g config set user root
USER docsworker-xlarge

ARG WORK_DIRECTORY=/home/docsworker-xlarge
WORKDIR ${WORK_DIRECTORY}

# get shared.mk
# TODO: revert this change
RUN curl https://raw.githubusercontent.com/mongodb/docs-worker-pool/07c515c250f71319249c4097fd1fef89f5c24ace/makefiles/shared.mk -o shared.mk

# install snooty parser
RUN git clone -b v${SNOOTY_PARSER_VERSION} --depth 1 https://github.com/mongodb/snooty-parser.git  \
    && python3 -m pip install pip==20.2 flit==${FLIT_VERSION}                                      \
    && cd snooty-parser                                                                            \
    && python3 -m flit install

# install snooty frontend and docs-tools
RUN git clone -b v${SNOOTY_FRONTEND_VERSION} --depth 1 https://github.com/mongodb/snooty.git       \
    && cd snooty                                                                                   \
    && npm install                                                                                 \
    && git clone --depth 1 https://github.com/mongodb/docs-tools.git                               \
    && mkdir -p ./static/images                                                                    \
    && mv ./docs-tools/themes/mongodb/static ./static/docs-tools                                   \
    && mv ./docs-tools/themes/guides/static/images/bg-accent.svg ./static/docs-tools/images/bg-accent.svg

# install snooty devhub
RUN git clone --depth 1 https://github.com/mongodb/devhub.git snooty-devhub                        \
    && cd snooty-devhub                                                                            \
    && npm install --production

COPY --from=ts-compiler /home/docsworker-xlarge/package*.json ./
COPY --from=ts-compiler /home/docsworker-xlarge/config config/
COPY --from=ts-compiler /home/docsworker-xlarge/build ./
RUN npm install

# Persistence module copy
# Create directory and add permissions to allow node module installation
RUN mkdir -p modules/persistence && chmod 755 modules/persistence
COPY --from=ts-compiler /home/docsworker-xlarge/modules/persistence/package*.json ./modules/persistence/
COPY --from=ts-compiler /home/docsworker-xlarge/modules/persistence/dist ./modules/persistence/
ENV PERSISTENCE_MODULE_PATH=${WORK_DIRECTORY}/modules/persistence/index.js
RUN cd ./modules/persistence/ && ls && npm install

RUN mkdir repos && chmod 755 repos
EXPOSE 3000
CMD ["node", "app.js"]
