FROM ubuntu-python-node
ARG SNOOTY_PARSER_VERSION=0.13.4
ARG SNOOTY_FRONTEND_VERSION=0.13.12
ARG FLIT_VERSION=3.0.0
ENV FLIT_ROOT_INSTALL=1
# ENV PATH="${PATH}:/home/docsworker-xlarge/.local/bin:/usr/local/lib/python2.7/dist-packages/virtualenv/bin"

WORKDIR /opt

# install docs-tools giza python requirements
RUN virtualenv /venv                           \
    && /venv/bin/pip install -U pip setuptools \
    && /venv/bin/pip install -r https://raw.githubusercontent.com/mongodb/docs-tools/master/giza/requirements.txt

# install snooty parser # TODO: install from pypi?
RUN git clone -b v${SNOOTY_PARSER_VERSION} --depth 1 https://github.com/mongodb/snooty-parser.git  \
    && python3 -m pip install flit==${FLIT_VERSION}                                                \
    && cd snooty-parser                                                                            \
    && python3 -m flit install

# install snooty frontend and docs-tools # TODO: install from npm?
RUN git clone -b v${SNOOTY_FRONTEND_VERSION} --depth 1 https://github.com/mongodb/snooty.git       \
    && cd snooty                                                                                   \
    && npm install                                                                                 \
    && git clone --depth 1 https://github.com/mongodb/docs-tools.git                               \
    && mkdir -p static/images                                                                      \
    && mv docs-tools/themes/mongodb/static static/docs-tools                                       \
    && mv docs-tools/themes/guides/static/images/bg-accent.svg static/docs-tools/images/bg-accent.svg

# install snooty devhub?
RUN git clone --depth 1 https://github.com/mongodb/devhub.git snooty-devhub                        \
    && cd snooty-devhub                                                                            \
    && npm install --production

#USER docsworker-xlarge
#WORKDIR /home/docsworker-xlarge
