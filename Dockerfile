# get nodejs
FROM node:10.10.0

# # make sure submodules are installed 
# RUN git submodule init
# RUN git submodule update

# create working directory  
COPY worker/ .
RUN mkdir -p static/images/
RUN mkdir -p staging/
RUN mv docs-tools/themes/mongodb/static static/static/
RUN mv snooty/front-end/gatsby-config.js .
RUN mv snooty/front-end/gatsby-node.js .
RUN mv snooty/front-end/src .

# install the node dependencies
RUN npm -g config set user root
RUN npm install --only=production
RUN npm -g install gatsby

# entry to kick-off the worker
CMD ["node", "index"]