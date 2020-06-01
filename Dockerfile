FROM node:12.16-alpine as builder
WORKDIR /opt/amqp10-converter
COPY . /opt/amqp10-converter
RUN npm install && npm run build:production

FROM node:12.16-alpine as production
ENV NODE_ENV=production
RUN apk add --no-cache tini
WORKDIR /opt/amqp10-converter
COPY --from=builder /opt/amqp10-converter/build/bundle.js ./build/
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "/opt/amqp10-converter/build/bundle.js"]
