import express from 'express';

import { CmdRouter } from '@/routes/cmd';
import * as handlers from '@/routes/handlers';
import { Consumer, Producer } from '@/bindings/amqp10';

const port = process.env.PORT || 3000;
const basePath = process.env.BASE_PATH || '/amqp10';

const consumer = new Consumer();
const producer = new Producer();
const cmdRouter = new CmdRouter(producer);

const app: express.Express = express();
app.use(handlers.defaultContentTypeMiddleware);
app.use(express.json());

app.use(basePath, cmdRouter.router);
app.use(handlers.notFoundHandler);
const server = app.listen(port, () => {
  console.log(`start listening on port ${port}`);
});

consumer.consume()
  .then((connectedUrl) => {
    console.log(`start consuming url: ${connectedUrl}`);
  })
  .catch((err) => {
    console.error('faild starting Consumer', err);
  });

process.on("SIGTERM", (): void => {
  console.log("Got SIGTERM");
  (async (): Promise<void> => {
    await producer.close();
    await consumer.close();
    await server.close();
  })().then(() => {
    console.log("shutted down gracefully")
  }).catch((err) => {
    console.log("shutterror", err);
  });
});