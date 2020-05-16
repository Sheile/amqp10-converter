import { Router, Request, Response } from 'express';
import log4js from 'log4js';
import { Producer } from '@/bindings/amqp10';
import { Entity } from '@/common';

const logger = log4js.getLogger('cmd');

export class CmdRouter {
  private _router = Router();
  get router(): Router {
    return this._router;
  }

  constructor(private producer: Producer) {
    this._router.post('/cmd/:type/:id', (req: Request, res: Response) => {
      logger.debug(`post /cmd/:type/:id`, req.params, req.body);
      const entity = new Entity(req.params.type, req.params.id);
      this.producer.produce(entity, req.body)
        .then((deliveryId) => {
          logger.debug(`sent cmd to AMQP Server, cmd: ${JSON.stringify(req.body)}, delivered id: ${deliveryId}`)
          res.status(200).json({ deliveryId: deliveryId });
        })
        .catch((err) => {
          logger.error(`failed sending cmd, ${JSON.stringify(req.body)}`, err);
          res.status(500).json({ msg: 'failed sending cmd', cmd: req.body, error: err });
        })
    });
  }
}