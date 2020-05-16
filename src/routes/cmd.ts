import { Router, Request, Response } from 'express';
import { Producer } from '@/bindings/amqp10';
import { Entity } from '@/common';

export class CmdRouter {
  private _router = Router();
  get router(): Router {
    return this._router;
  }

  constructor(private producer: Producer) {
    this._router.post('/cmd/:type/:id', (req: Request, res: Response) => {
      const entity = new Entity(req.params.type, req.params.id);
      this.producer.produce(entity, req.body)
        .then((deliveryId) => {
          console.log(`sent cmd to AMQP Server, cmd: ${JSON.stringify(req.body)}, delivered id: ${deliveryId}`)
          res.status(200).json({ deliveryId: deliveryId });
        })
        .catch((err) => {
          console.error(`failed sending cmd, ${JSON.stringify(req.body)}`, err);
          res.status(500).json({ msg: 'failed sending cmd', cmd: req.body, error: err });
        })
    });
  }
}