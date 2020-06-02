FROM node:12.16-alpine

ENV NODE_ENV=production
WORKDIR /opt
RUN apk add --no-cache tini

COPY ./package.json /opt
COPY ./package-lock.json /opt
COPY ./main.js /opt
COPY ./connect.js /opt
COPY ./consume.js /opt
COPY ./produce.js /opt
RUN npm install

ENTRYPOINT ["/sbin/tini", "--", "node", "/opt/main.js"]
