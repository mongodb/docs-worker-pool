FROM node:18.16.0-alpine 

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . ./

CMD ["node", "app.js"]