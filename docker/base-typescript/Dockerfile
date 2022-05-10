FROM node:14-alpine3.10
WORKDIR /home/docsworker-xlarge
COPY package.json package-lock.json tsconfig.json ./
COPY config config
RUN npm install
# TODO: copy only relevant source code
COPY . ./
RUN npm run build
