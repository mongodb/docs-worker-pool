FROM ubuntu:16.04

# install legacy build environment for docs
RUN echo "deb [check-valid-until=no] http://archive.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/jessie-backports.list
RUN sed -i '/deb http:\/\/deb.debian.org\/debian jessie-updates main/d' /etc/apt/sources.list
RUN apt-get -o Acquire::Check-Valid-Until=false update
RUN apt-get -y install libpython2.7-dev python2.7 git python-pip rsync
RUN pip install requests virtualenv virtualenvwrapper py-dateutil
RUN python2 -m pip install python-dateutil
RUN python -m pip install --upgrade --force pip
RUN virtualenv /venv
RUN /venv/bin/pip install --upgrade --force setuptools
RUN /venv/bin/pip install giza sphinx==1.6.6

# get python 3.6
# https://hub.docker.com/r/miseyu/docker-ubuntu16-python3.6/dockerfile
RUN apt-get update && apt-get install -y software-properties-common && add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y python3.6 python3.6-dev python3-pip
RUN ln -sfn /usr/bin/python3.6 /usr/bin/python3 && ln -sfn /usr/bin/python3 /usr/bin/python && ln -sfn /usr/bin/pip3 /usr/bin/pip

# helper libraries for docs builds
RUN apt-get -y install python3-pip python3-venv git pkg-config libxml2-dev
RUN python3 -m pip install mut
RUN python3 -m pip install typing

RUN echo "export PATH=$PATH:/usr/local/lib/python2.7/dist-packages/virtualenv/bin" > /etc/environment

# get node 12
# https://gist.github.com/RinatMullayanov/89687a102e696b1d4cab
RUN apt-get install --yes curl
RUN curl --location https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

RUN useradd -ms /bin/bash docsworker

# install the node dependencies for worker pool
RUN npm -g config set user root
#RUN npm install

USER docsworker
WORKDIR /home/docsworker
COPY worker/ .
run npm install

# entry to kick-off the worker
EXPOSE 3000
CMD ["npm", "start"]


