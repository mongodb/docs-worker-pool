FROM ubuntu-python-node
ARG SNOOTY_PARSER_VERSION=0.13.4
ARG SNOOTY_FRONTEND_VERSION=0.13.12
ARG FLIT_VERSION=3.0.0
ENV FLIT_ROOT_INSTALL=1
ENV PATH="${PATH}:/home/docsworker-xlarge/.local/bin:/usr/local/lib/python2.7/dist-packages/virtualenv/bin"

WORKDIR /opt

RUN virtualenv /venv                           \
    && /venv/bin/pip install -U pip setuptools \
    && /venv/bin/pip install -r https://raw.githubusercontent.com/mongodb/docs-tools/master/giza/requirements.txt

RUN git clone -b v${SNOOTY_PARSER_VERSION} --depth 1 https://github.com/mongodb/snooty-parser.git \
    && pip install flit==${FLIT_VERSION} && python3 -m flit install

#USER docsworker-xlarge
#WORKDIR /home/docsworker-xlarge
