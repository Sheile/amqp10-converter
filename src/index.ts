import express from 'express';
import log4js from 'log4js';
import { CmdRouter } from '@/routes/cmd';
import * as handlers from '@/routes/handlers';
import { Consumer, Producer } from '@/bindings/amqp10';

const port = process.env.PORT || 3000;
const logLevel = process.env.LOG_LEVEL || 'info';
const basePath = process.env.BASE_PATH || '/amqp10';

log4js.configure({
  appenders: { stdout: { type: 'stdout', layout: { type: 'pattern', pattern: '%[%d{ISO8601_WITH_TZ_OFFSET} [%5p]%] %c% - %m' } } },
  categories: { default: { appenders: ['stdout'], level: logLevel } },
});
const logger = log4js.getLogger('index');

const consumer = new Consumer();
const producer = new Producer();
const cmdRouter = new CmdRouter(producer);

const app: express.Express = express();
app.use(handlers.defaultContentTypeMiddleware);
app.use(express.json());

app.use(basePath, cmdRouter.router);
app.use(handlers.notFoundHandler);
const server = app.listen(port, () => {
  logger.info(`start listening on port ${port}`);
});

consumer.consume()
  .then((connectedUrl) => {
    logger.info(`start consuming on url ${connectedUrl}`);
  })
  .catch((err) => {
    logger.error('faild starting Consumer', err);
  });

process.on("SIGTERM", (): void => {
  logger.info("Got SIGTERM");
  (async (): Promise<void> => {
    await producer.close();
    await consumer.close();
    await server.close();
  })().then(() => {
    logger.info("shutted down gracefully")
  }).catch((err) => {
    logger.error("shutterror", err);
  });
});