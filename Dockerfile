FROM ubuntu:disco

# install legacy build environment for docs
RUN apt-get -o Acquire::Check-Valid-Until=false update
RUN apt-get -y install libpython2.7-dev python2.7 git python-pip rsync
RUN pip install requests virtualenv virtualenvwrapper py-dateutil
RUN python2 -m pip install python-dateutil 
RUN python -m pip install --upgrade --force pip
RUN virtualenv /venv
RUN /venv/bin/pip install --upgrade --force setuptools
RUN /venv/bin/pip install -r https://raw.githubusercontent.com/mongodb/docs-tools/master/giza/requirements.txt

# helper libraries for docs builds
RUN apt-get update && apt-get install -y python3 python3-dev python3-pip
RUN apt-get -y install git pkg-config libxml2-dev
RUN python3 -m pip install mut
ENV PATH="${PATH}:/usr/local/lib/python2.7/dist-packages/virtualenv/bin"

# get node 12
# https://gist.github.com/RinatMullayanov/89687a102e696b1d4cab
RUN apt-get install --yes curl
RUN curl --location https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install --yes nodejs
RUN apt-get install --yes build-essential

# setup user and root directory
RUN useradd -ms /bin/bash docsworker
RUN npm -g config set user root
USER docsworker

WORKDIR /home/docsworker

# install snooty parser
RUN python3 -m pip uninstall -y snooty
RUN python3 -m pip install --upgrade pip flit
RUN git clone https://github.com/mongodb/snooty-parser.git && \
	cd snooty-parser && \
	git fetch --tags && \
	latestTag=$(git describe --tags `git rev-list --tags --max-count=1`) && \
	git checkout "$latestTag" && \
	FLIT_ROOT_INSTALL=1 python3 -m flit install
ENV PATH="${PATH}:/home/docsworker/.local/bin"

# install snooty front-end
RUN git clone https://github.com/mongodb/snooty.git snooty
RUN cd snooty && \
	git fetch --all && \
	git reset --hard origin/master && \
	npm install && \
	git clone https://github.com/mongodb/docs-tools.git docs-tools && \
	mkdir -p ./static/images && \
	mv ./docs-tools/themes/mongodb/static ./static/docs-tools/ && \
	mv ./docs-tools/themes/guides/static/images/bg-accent.svg ./static/docs-tools/images/bg-accent.svg

# install the node dependencies for worker pool
COPY worker/ . 
RUN npm install

# where repo work will happen
RUN mkdir repos && chmod 755 repos

# entry to kick-off the worker
EXPOSE 3000
CMD ["npm", "start"]
