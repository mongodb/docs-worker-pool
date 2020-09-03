FROM ubuntu:20.04
ARG DEBIAN_FRONTEND=noninteractive

# install legacy build environment for docs
RUN apt-get -o Acquire::Check-Valid-Until=false update
RUN apt-get -y install libpython2.7-dev python2.7 git rsync
RUN apt-get -y install curl
RUN curl https://bootstrap.pypa.io/get-pip.py --output get-pip.py
RUN python2.7 get-pip.py
RUN pip install requests virtualenv virtualenvwrapper py-dateutil
RUN python2.7 -m pip install python-dateutil 
RUN virtualenv /venv
RUN /venv/bin/pip install --upgrade --force setuptools
RUN /venv/bin/pip install -r https://raw.githubusercontent.com/mongodb/docs-tools/master/giza/requirements.txt

# helper libraries for docs builds
RUN apt-get update && apt-get install -y python3 python3-dev python3-pip
RUN apt-get -y install git pkg-config libxml2-dev
RUN python3 -m pip install mut
ENV PATH="${PATH}:/home/docsworker-xlarge/.local/bin:/usr/local/lib/python2.7/dist-packages/virtualenv/bin"

# get node 12
# https://gist.github.com/RinatMullayanov/89687a102e696b1d4cab
RUN apt-get install --yes curl
RUN curl --location https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# setup user and root directory
RUN useradd -ms /bin/bash docsworker-xlarge
RUN npm -g config set user root
USER docsworker-xlarge

WORKDIR /home/docsworker-xlarge

# install snooty parser
RUN python3 -m pip uninstall -y snooty
RUN python3 -m pip install --upgrade pip flit
RUN git clone https://github.com/mongodb/snooty-parser.git && \
	cd snooty-parser && \
	git fetch --tags && \
	latestTag=$(git describe --tags `git tag --sort=-v:refname` | head -n 1) && \
	git checkout "$latestTag" && \
	FLIT_ROOT_INSTALL=1 python3 -m flit install

# install snooty front-end
RUN git clone https://github.com/mongodb/snooty.git snooty
RUN cd snooty && \
	git fetch --all && \
	latestTag=$(git describe --tags `git rev-list --tags --max-count=1`) && \
	git checkout "$latestTag" && \	
	npm install --production && \
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
