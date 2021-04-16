FROM ubuntu:20.04
ARG DEBIAN_FRONTEND=noninteractive

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
RUN apt-get -y install git pkg-config libxml2-dev
RUN python3 -m pip install -r https://raw.githubusercontent.com/mongodb/mut/master/requirements.txt
ENV PATH="${PATH}:/home/docsworker-xlarge/.local/bin:/usr/local/lib/python2.7/dist-packages/virtualenv/bin"

# get node 14
# https://gist.github.com/RinatMullayanov/89687a102e696b1d4cab
RUN apt-get install --yes curl
RUN curl --location https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# setup user and root directory
RUN useradd -ms /bin/bash docsworker-xlarge
RUN npm -g config set user root
USER docsworker-xlarge

WORKDIR /home/docsworker-xlarge

# get shared.mk
RUN curl https://raw.githubusercontent.com/mongodb/docs-worker-pool/meta/makefiles/shared.mk -o shared.mk

# install snooty parser
RUN python3 -m pip uninstall -y snooty
RUN python3 -m pip install pip==20.2 flit==3.0.0
RUN git clone https://github.com/mongodb/snooty-parser.git && \
	cd snooty-parser && \
	git fetch --tags && \
	git checkout v0.9.6 && \
	FLIT_ROOT_INSTALL=1 python3 -m flit install

# install snooty front-end
RUN git clone https://github.com/mongodb/snooty.git snooty
RUN cd snooty && \
	git fetch --all && \
	git checkout v0.9.8 && \	
	npm install && \
	git clone https://github.com/mongodb/docs-tools.git docs-tools && \
	mkdir -p ./static/images && \
	mv ./docs-tools/themes/mongodb/static ./static/docs-tools/ && \
	mv ./docs-tools/themes/guides/static/images/bg-accent.svg ./static/docs-tools/images/bg-accent.svg

RUN git clone https://github.com/mongodb/devhub.git snooty-devhub
RUN cd snooty-devhub && \
	git fetch --all && \
	git checkout master && \	
	npm install --production

# install the node dependencies for worker pool
COPY worker/ . 
RUN npm install --production

# where repo work will happen
RUN mkdir repos && chmod 755 repos

# entry to kick-off the worker
EXPOSE 3000
CMD ["npm", "start"]
