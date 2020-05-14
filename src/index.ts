import express from 'express';

import cmd from '@/routes/cmd';
import * as handlers from '@/routes/handlers';
import { Consumer } from '@/bindings/amqp10';

const port = process.env.PORT || 3000;
const basePath = process.env.BASE_PATH || '/amqp10';

const app: express.Express = express();
app.use(handlers.defaultContentTypeMiddleware);
app.use(express.json());

app.use(basePath, cmd);
app.use(handlers.notFoundHandler);
app.listen(port, () => {
  console.log(`start listening on port ${port}`);
});

const consumer = new Consumer();
consumer.consume()
  .then((connectedUrl) => {
    console.log(`start consuming url: ${connectedUrl}`);
  })
  .catch((err) => {
    console.error('faild starting Consumer', err);
  });