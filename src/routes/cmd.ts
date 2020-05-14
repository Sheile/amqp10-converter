import { Router, Request, Response } from 'express';
import { Producer } from '@/bindings/amqp10';
import { Entity } from '@/common';

const router = Router();

router.post('/cmd/:type/:id', (req: Request, res: Response) => {
  const entity = new Entity(req.params.type, req.params.id);
  const producer = new Producer();
  producer.produce(entity, req.body)
    .then((deliveryId) => {
      console.log(`send cmd to AMQP Server, cmd: ${JSON.stringify(req.body)}, delivered id: ${deliveryId}`)
      res.status(200).json({deliveryId: deliveryId});
    })
    .catch((err) => {
      console.error(`failed sending cmd, ${JSON.stringify(req.body)}`, err);
      res.status(500).json({msg: 'failed sending cmd', cmd: req.body, error: err});
    })
});

export default router;