FROM ubuntu:20.04
ENV DEBIAN_FRONTEND=noninteractive

# install tools including python2 and python3
RUN apt-get update && apt-get install -y \
    build-essential                      \
    curl                                 \
    git                                  \
    libpython2.7-dev                     \
    libxml2-dev                          \
    pkg-config                           \
    python2.7                            \
    python3                              \
    python3-dev                          \
    python3-pip                          \
    rsync                                \
    vim                                  \
    && rm -rf /var/lib/apt/lists/*

# install helpful python packages
RUN curl https://bootstrap.pypa.io/pip/2.7/get-pip.py --output get-pip.py \
    && python2.7 get-pip.py                                               \
    && pip install requests virtualenv virtualenvwrapper py-dateutil      \
    && python2.7 -m pip install python-dateutil                           \
    && rm get-pip.py

# install nodejs 14 and npm 7
RUN curl https://deb.nodesource.com/setup_14.x | bash - \
    && apt-get install -y nodejs                        \
    && npm install npm@7                                \
    && rm -rf /var/lib/apt/lists/*
