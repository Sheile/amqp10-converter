import express from 'express';
import { CmdRouter } from '@/routes/cmd';
import { Producer } from '@/bindings/amqp10';
import { QueueDef, JsonType } from '@/common';
import request from 'supertest';

jest.mock('@/bindings/amqp10');
const ProducerMock = Producer as jest.Mock;

describe('/routes/cmd', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('CmdRouter', () => {
    describe.each([
      [true, 'returns 200 OK when Producer.produce resolved'],
      [false, 'returns 500 Server Error when Producer.produce rejected'],
    ])('when posted data to "/cmd/:type/:id', (isResolved, desc) => {
      const deliveryId = 0;

      describe.each([
        [undefined],
        ['fs']
      ])('when FIWARE-SERVICE is %s', (fiwareService) => {
        describe.each([
          [undefined],
          ['fsp'],
        ])('when FIWARE-SERVICEPATH is %s', (fiwareServicePath) => {

          it(desc, async () => {
            const mockProduceFunc = jest.fn();

            ProducerMock.mockImplementation(() => {
              return {
                produce: async (queueDef: QueueDef, data: JsonType): Promise<number> => {
                  mockProduceFunc(queueDef, data);
                  if (!isResolved) throw new Error('rejected!');
                  return deliveryId;
                },
              }
            });

            const producer = new Producer();
            const cmdRouter = new CmdRouter(producer);

            const app = express();
            app.use(express.json());
            app.use('/', cmdRouter.router);

            const req = request(app).post('/cmd/t01/i01');
            if (fiwareService != null) req.set('fiware-service', fiwareService);
            if (fiwareServicePath != null) req.set('fiware-servicepath', fiwareServicePath);
            const response = await req.send({ cmd: { open: 'window1' } });
            if (isResolved) {
              expect(response.status).toBe(200);
              expect(response.body).toMatchObject({ deliveryId: deliveryId });
            } else {
              expect(response.status).toBe(500);
              expect(response.body).toMatchObject({ msg: 'failed sending cmd', cmd: { cmd: { open: 'window1' } }, error: {} });
            }
            expect(mockProduceFunc).toHaveBeenCalledTimes(1);
            expect(mockProduceFunc.mock.calls[0].length).toBe(2);
            expect(mockProduceFunc.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01', fiwareService, fiwareServicePath));
            expect(mockProduceFunc.mock.calls[0][1]).toMatchObject({ cmd: { open: 'window1' } });
          });

        });
      });
    });
  });
});