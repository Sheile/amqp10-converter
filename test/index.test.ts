import express from 'express';
import log4js from 'log4js';
import { CmdRouter } from '@/routes/cmd';
import * as handlers from '@/routes/handlers';
import { Consumer, Producer } from '@/bindings/amqp10';

jest.mock('express', () => {
  return require('jest-express');
});
jest.mock('@/routes/cmd');
const CmdRouterMock = CmdRouter as jest.Mock;
jest.mock('@/bindings/amqp10');
const ConsumerMock = Consumer as jest.Mock;
const ProducerMock = Producer as jest.Mock;

describe('index', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let index: any;
  const mockLogInfo = jest.fn();
  const mockLogError = jest.fn();
  const mockRouter = jest.fn();
  const mockConsumerCloseFunc = jest.fn();
  const mockProducerCloseFunc = jest.fn();
  const mockServerCloseFunc = jest.fn();
  const mockConsumeFunc = jest.fn();

  beforeEach(() => {
    express.json = jest.fn().mockReturnValue('jest-express.json().mockReturnValue');
    log4js.getLogger = jest.fn().mockImplementation(() => {
      return {
        info: mockLogInfo,
        error: mockLogError,
      };
    });
    ConsumerMock.mockImplementation(() => {
      return {
        consume: mockConsumeFunc,
        close: mockConsumerCloseFunc,
      };
    });
    ProducerMock.mockImplementation(() => {
      return {
        close: mockProducerCloseFunc,
      }
    });
    CmdRouterMock.mockImplementation(() => {
      return {
        router: mockRouter,
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe.each([
    [undefined, undefined],
    ['5432', '/foobar'],
  ])('when starting [environment variables (PORT=%s, BASE_PATH=%s]', (port, basePath) => {
    describe.each([
      ['listener and consumer start gracefully when consumer.consume resolved', true],
      ['listener start gracefully, but consumer fails starting when consumer.consume rejected', false],
    ])('', (desc, isResolved) => {
      it(desc, (done) => {
        jest.isolateModules(() => {
          if (port) process.env.PORT = port;
          if (basePath) process.env.BASE_PATH = basePath;
          mockConsumeFunc.mockReturnValue((async (): Promise<string> => {
            if (!isResolved) throw new Error('rejected!');
            return 'testurl';
          })());
          index = require('@/index');
        });

        // const index = require('@/index');
        expect(index.app.use.mock.calls.length).toBe(4);

        // app.use(handlers.defaultContentTypeMiddleware)
        expect(index.app.use.mock.calls[0].length).toBe(1);
        expect(index.app.use.mock.calls[0][0]).toBe(handlers.defaultContentTypeMiddleware);

        // app.use(express.json())
        expect(index.app.use.mock.calls[1].length).toBe(1);
        expect(index.app.use.mock.calls[1][0]).toBe(express.json());
        expect(express.json).toHaveBeenCalledWith();

        // app.use(basePath, cmdRouter.router)
        expect(index.app.use.mock.calls[2].length).toBe(2);
        expect(index.app.use.mock.calls[2][0]).toBe((basePath) ? basePath : '/amqp10');
        expect(index.app.use.mock.calls[2][1]).toBe(mockRouter);
        expect(CmdRouterMock.mock.calls[0][0]).toMatchObject(new Producer());

        // app.use(handlers.notFoundHandler)
        expect(index.app.use.mock.calls[3].length).toBe(1);
        expect(index.app.use.mock.calls[3][0]).toBe(handlers.notFoundHandler);

        // app.listen
        index.app.listen.mock.calls[0][1]();
        expect(index.app.listen).toHaveBeenCalledTimes(1);
        expect(index.app.listen.mock.calls[0].length).toBe(2);
        const p = (port) ? port : '3000';
        expect(index.app.listen.mock.calls[0][0]).toBe(parseInt(p));
        expect(mockLogInfo.mock.calls.length).toBe(1);
        expect(mockLogInfo.mock.calls[0][0]).toBe(`start listening on port ${p}`);

        process.nextTick(() => {
          if (isResolved) {
            expect(mockLogInfo.mock.calls.length).toBe(2);
            expect(mockLogError.mock.calls.length).toBe(0);
            expect(mockLogInfo.mock.calls[1][0]).toBe('start consuming on url testurl');
          } else {
            expect(mockLogInfo.mock.calls.length).toBe(1);
            expect(mockLogError.mock.calls.length).toBe(1);
            expect(mockLogError.mock.calls[0][0]).toBe('failed starting Consumer');
          }
          done();
        });
      });
    });
  });

  describe('when receive SIGTERM signal', () => {
    const processEvents: {[signal: string]: () => void} = {};

    beforeEach(() => {
      process.on = jest.fn().mockImplementation((signal: string, cb: () => void): void => {
        processEvents[signal] = cb;
      });
      process.kill = jest.fn().mockImplementation((_, signal: string) => {
        processEvents[signal]();
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    describe.each([
      [true, true, true],
      [true, true, false],
      [true, false, true],
      [true, false, false],
      [false, true, true],
      [false, true, false],
      [false, false, true],
      [false, false, false],
    ])('', (isProducerResolved, isConsumerResolved, isServerResolved) => {
      const pmsg = (isProducerResolved) ? 'resolved' : 'rejected';
      const cmsg = (isConsumerResolved) ? 'resolved' : 'rejected';
      const smsg = (isServerResolved) ? 'resolved' : 'rejected';
      const msg = (isProducerResolved && isConsumerResolved && isServerResolved) ?
        `shutted down gracefully (producer.close() ${pmsg}, consumer.close() ${cmsg}, server.close() ${smsg}` :
        `failed shutting down (producer.close() ${pmsg}, consumer.close() ${cmsg}, server.close() ${smsg}`;
      it(msg, (done) => {
        jest.isolateModules(() => {
          mockConsumeFunc.mockReturnValue((async (): Promise<string> => {
            return 'testurl';
          })());
          mockProducerCloseFunc.mockReturnValue((async (): Promise<void> => {
            if (!isProducerResolved) throw new Error('producer.close() rejected!');
            return
          })());
          mockConsumerCloseFunc.mockReturnValue((async (): Promise<void> => {
            if (!isConsumerResolved) throw new Error('consumer.close() rejected!');
            return
          })());
          mockServerCloseFunc.mockReturnValue((async (): Promise<void> => {
            if (!isServerResolved) throw new Error('server.close() rejected!');
            return
          })());

          index = require('@/index');
          index.server = {
            close: mockServerCloseFunc,
          };
        });
        process.kill(process.pid, 'SIGTERM');
        process.nextTick(() => {
          expect(mockProducerCloseFunc).toHaveBeenCalledWith();
          expect(mockConsumerCloseFunc).toHaveBeenCalledWith();
          expect(mockServerCloseFunc).toHaveBeenCalledWith();
          if (isProducerResolved && isConsumerResolved && isServerResolved) {
            expect(mockLogInfo.mock.calls.length).toBe(3);
            expect(mockLogError.mock.calls.length).toBe(0);
            expect(mockLogInfo.mock.calls[0][0]).toBe('Got SIGTERM');
            expect(mockLogInfo.mock.calls[1][0]).toBe('start consuming on url testurl');
            expect(mockLogInfo.mock.calls[2][0]).toBe('shutted down gracefully');
          } else {
            expect(mockLogInfo.mock.calls.length).toBe(2);
            expect(mockLogError.mock.calls.length).toBe(1);
            expect(mockLogInfo.mock.calls[0][0]).toBe('Got SIGTERM');
            expect(mockLogInfo.mock.calls[1][0]).toBe('start consuming on url testurl');
            expect(mockLogError.mock.calls[0][0]).toBe('failed shutting down');
          }
          done();
        });
      });
    });
  });
});