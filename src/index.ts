import express from 'express';

import * as handlers from '@/routes/handlers';
import { Consumer } from '@/bindings/amqp10';

const port = process.env.PORT || 3000;

const app: express.Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(handlers.notFoundHandler);
app.listen(port, () => {
  console.log(`start listening on port ${port}`);
});

const consumer: Consumer = new Consumer();
consumer.consume(() => {
  console.log('start consuming');
});