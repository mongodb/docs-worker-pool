# get nodejs
FROM node:10.16.0

# # make sure submodules are installed 
#RUN git submodule init
#RUN git submodule update

#install legacy build environment
RUN echo "deb [check-valid-until=no] http://archive.debian.org/debian jessie-backports main" > /etc/apt/sources.list.d/jessie-backports.list
RUN sed -i '/deb http:\/\/deb.debian.org\/debian jessie-updates main/d' /etc/apt/sources.list
RUN apt-get -o Acquire::Check-Valid-Until=false update
RUN apt-get -y install libpython2.7-dev python2.7 git python-pip rsync
RUN pip install requests virtualenv virtualenvwrapper py-dateutil
RUN python -m pip install --upgrade --force pip

RUN virtualenv /venv
RUN /venv/bin/pip install --upgrade --force setuptools
RUN /venv/bin/pip install giza sphinx==1.6.6

RUN apt-get -y install python3-pip
#RUN apt-get -y install python3 python3-pip python3-venv git pkg-config libxml2-dev
RUN python3 -m pip install mut
RUN python3 -m pip install typing
#RUN pip install virtualenv
#RUN pip install setuptools

# create working directory  
COPY worker/ .
#RUN mkdir -p static/images/
#RUN mkdir -p staging/
#RUN mv docs-tools/themes/mongodb/static static/static/
#RUN mv snooty/front-end/gatsby-config.js .
#RUN mv snooty/front-end/gatsby-node.js .
#RUN mv snooty/front-end/src .

# install the node dependencies
RUN npm -g config set user root
RUN npm install

#RUN npm -g install gatsby

# entry to kick-off the worker
EXPOSE 3000
CMD ["npm", "start"]
RUN echo "export PATH=$PATH:/usr/local/lib/python2.7/dist-packages/virtualenv/bin" > /etc/environment

