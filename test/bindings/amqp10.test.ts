import { writeFileSync } from 'fs';
import { EventEmitter } from 'events';
import { Connection, ConnectionOptions, ReceiverEvents } from 'rhea-promise';
import { fileSync } from 'tmp-promise';
import { sendAttributes } from '@/bindings/iotagent-json';
import { activate, setCommandResult, deactivate } from '@/bindings/iotagent-lib';
import { QueueDef, Entity } from '@/common';

jest.mock('rhea-promise');
const ConnectionMock = Connection as unknown as jest.Mock;
const connOpenMock = jest.fn();
const connCloseMock = jest.fn();
const connCreateReceiverMock = jest.fn();
const connCreateAwaitableSenderMock = jest.fn();
const deliveryAcceptMock = jest.fn();
const deliveryReleaseMock = jest.fn();
const deliveryRejectMock = jest.fn();
const receiverCloseMock = jest.fn();
const senderSendMock = jest.fn();
const senderCloseMock = jest.fn();

jest.mock('@/bindings/iotagent-json');
const sendAttributesMock = sendAttributes as jest.Mock;

jest.mock('@/bindings/iotagent-lib');
const activateMock = activate as jest.Mock;
const setCommandResultMock = setCommandResult as jest.Mock;
const deactivateMock = deactivate as jest.Mock;

describe('/bindigs/amqp10', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let amqp10: any;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe.each([
    [null, null, null, null, null],
    ['amqp.example.com', '25672', 'amqpuser', 'amqppassword', 'true'],
  ])('when environment vairables is like this (AMQP_HOST=%s, AMQP_PORT=%s, AMQP_USERNAME=%s, AMQP_PASSWORD=%s, AMQP_USE_TLS=%s',
  (amqpHost, amqpPort, amqpUsername, amqpPassword, amqpUseTLS) => {
    beforeEach(() => {
      if (amqpHost !== null) process.env.AMQP_HOST = amqpHost;
      if (amqpPort !== null) process.env.AMQP_PORT = amqpPort;
      if (amqpUsername !== null) process.env.AMQP_USERNAME = amqpUsername;
      if (amqpPassword !== null) process.env.AMQP_PASSWORD = amqpPassword;
      if (amqpUseTLS !== null) process.env.AMQP_USE_TLS = amqpUseTLS;
    });

    afterEach(() => {
      if (amqpHost !== null) delete process.env.AMQP_HOST;
      if (amqpPort !== null) delete process.env.AMQP_PORT;
      if (amqpUsername !== null) delete process.env.AMQP_USERNAME;
      if (amqpPassword !== null) delete process.env.AMQP_PASSWORD;
      if (amqpUseTLS !== null) delete process.env.AMQP_USE_TLS;
    });

    describe('AMQPBase', () => {
      beforeEach(() => {
        ConnectionMock.mockImplementation(() => {
          return {
            open: connOpenMock,
            close: connCloseMock,
          }
        });
      });

      describe.each([
        [null, [new QueueDef('type0', 'id0')]],
        ['', [new QueueDef('type0', 'id0')]],
        ['[{"type":"t01","id":"i01"}]', [new QueueDef('t01', 'i01')]],
        ['[{"type":"t01","id":"i01"},{"type":"t02","id":"i02","foo":"bar"}]', [new QueueDef('t01', 'i01'), new QueueDef('t02', 'i02')]],
      ])('when the QUEUE_DEFS environment variable is this QUEUE_DEFS=%s', (queueDefsStr, queueDefs) => {
        beforeEach(() => {
          if (queueDefsStr !== null) process.env.QUEUE_DEFS = queueDefsStr;
        });

        afterEach(() => {
          if (queueDefsStr !== null) delete process.env.QUEUE_DEFS;
        });

        it('creates new instance successfully with valid entities', () => {
          jest.isolateModules(() => {
            amqp10 = require('@/bindings/amqp10');
          });
          const base = new amqp10.AMQPBase();
          expect(base.queueDefs).toMatchObject(queueDefs);
        });
      });

      describe.each([
        ['{"type":"t01","id":"i01"}'],
        ['[{"type":"t01","id":"i01"},{"id":"i02"}]'],
        ['[{"type":"t01","id":"i01"},"abc"]'],
        ['[{"a":"b"}]'],
        ['[[['],
        ['invalid'],
        ['123'],
      ])('when the QUEUE_DEFS environment variable is this QUEUE_DEFS=%s', (queueDefsStr) => {
        beforeEach(() => {
          if (queueDefsStr !== null) process.env.QUEUE_DEFS = queueDefsStr;
        });

        afterEach(() => {
          if (queueDefsStr !== null) delete process.env.QUEUE_DEFS;
        });

        it('throw an error when creating new instance because entities are invalid', () => {
          jest.isolateModules(() => {
            amqp10 = require('@/bindings/amqp10');
          });
          expect(() => {
            new amqp10.AMQPBase();
          }).toThrowError();
        });
      });

      describe('when connection.open resolved', () => {
        it('connects successfully', (done) => {
          jest.isolateModules(() => {
            connOpenMock.mockReturnValue(new Promise((resolve) => {
              resolve();
            }));
            amqp10 = require('@/bindings/amqp10');
          });
          let connection: Connection;
          const base = new amqp10.AMQPBase();

          base.getConnection()
            .then((c: Connection) => {
              connection = c;
            })
            .catch(() => {
              done.fail();
            })
            .finally(() => {
              expect(ConnectionMock).toHaveBeenCalledTimes(1);
              const options: ConnectionOptions = {
                hostname: (amqpHost !== null) ? amqpHost : 'localhost',
                host: (amqpHost !== null) ? amqpHost : 'localhost',
                port: (amqpPort !== null) ? parseInt(amqpPort) : 5672,
                username: (amqpUsername !== null) ? amqpUsername : 'ANONYMOUS',
              };
              if (amqpPassword !== null) options.password = amqpPassword;
              if (amqpUseTLS !== null) options.transport = 'tls';
              expect(ConnectionMock.mock.calls[0][0]).toMatchObject(options);
              expect(connOpenMock).toHaveBeenCalledTimes(1);

              // when called getConnection again, the cached same connection is returned
              base.getConnection()
                .then((c: Connection) => {
                  expect(c).toBe(connection);
                })
                .finally(() => {
                  expect(ConnectionMock).toHaveBeenCalledTimes(1);
                  expect(connOpenMock).toHaveBeenCalledTimes(1);
                  done();
                });
            });
        });
      });

      describe('when connection.open rejected', () => {
        it('fails to connect', (done) => {
          jest.isolateModules(() => {
            connOpenMock.mockReturnValue(new Promise((_, reject) => {
              reject(new Error('rejected'));
            }));
            amqp10 = require('@/bindings/amqp10');
          });
          const base = new amqp10.AMQPBase();

          base.getConnection()
            .then(() => {
              done.fail();
            })
            .catch(() => {
              expect(ConnectionMock).toHaveBeenCalledTimes(1);
            })
            .finally(() => {
              done();
            });
        });
      });

      describe('when connection is not opened', () => {
        it('nothing to do when close called', (done) => {
          jest.isolateModules(() => {
            amqp10 = require('@/bindings/amqp10');
          });
          const base = new amqp10.AMQPBase();
          base.close()
            .then(() => {
              expect(connOpenMock).not.toHaveBeenCalled();
              expect(connCloseMock).not.toHaveBeenCalled();
            })
            .catch(() => {
              done.fail();
            })
            .finally(() => {
              done();
            });
        })
      });

      describe.each([
        [true, 'closes successfully when connection.close resolved'],
        [false, 'fails closing when connection.close rejected'],
      ])('when connection is opened', (isResolved, desc) => {
        it(desc, (done) => {
          jest.isolateModules(() => {
            connOpenMock.mockReturnValue(new Promise((resolve) => {
              resolve();
            }));
            connCloseMock.mockReturnValue(new Promise((resolve, reject) => {
              if (isResolved) {
                resolve();
              } else {
                reject(new Error('rejected'));
              }
            }));
            amqp10 = require('@/bindings/amqp10');
          });
          const base = new amqp10.AMQPBase();
          (async (): Promise<void> => {
            await base.getConnection();
            await base.close();
          })().then(() => {
              if (!isResolved) done.fail();
            })
            .catch(() => {
              if (isResolved) done.fail();
            })
            .finally(() => {
              expect(connOpenMock).toHaveBeenCalledTimes(1);
              expect(connCloseMock).toHaveBeenCalledTimes(1);
              done();
            });
        });
      });
    });

    describe('Consumer', () => {
      beforeEach(() => {
        ConnectionMock.mockImplementation(() => {
          return {
            open: connOpenMock,
            close: connCloseMock,
            createReceiver: connCreateReceiverMock,
          }
        });
      });

      describe.each([
        [null, [new QueueDef('type0', 'id0')]],
        ['[{"type":"t01","id":"i01"},{"type":"t02","id":"i02","foo":"bar"}]', [new QueueDef('t01', 'i01'), new QueueDef('t02', 'i02')]],
      ])('when the QUEUE_DEFS enviroment variable is %s', (queueDefsStr, queueDefs) => {
        beforeEach(() => {
          if (queueDefsStr !== null) process.env.QUEUE_DEFS = queueDefsStr;
        });

        afterEach(() => {
          if (queueDefsStr !== null) delete process.env.QUEUE_DEFS;
        });

        describe('when connection.open resolved, connection.createReceiver resolved and activate resolved', () => {
          it('consumes successfully', (done) => {
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(new EventEmitter());
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then((url: string) => {
                const u = `${(amqpHost !== null) ? amqpHost : 'localhost'}:${(amqpPort !== null) ? amqpPort : '5672'}`
                expect(url).toBe(u);
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                expect(ConnectionMock).toHaveBeenCalledTimes(1);
                expect(connOpenMock).toHaveBeenCalledTimes(1);
                expect(connCreateReceiverMock).toHaveBeenCalledTimes(queueDefs.length);
                queueDefs.forEach((queueDef, i) => {
                  expect(connCreateReceiverMock.mock.calls[i][0]).toMatchObject({
                    source: {
                      address: queueDef.upstreamQueue,
                    },
                    autoaccept: false,
                  });
                });
                expect(activateMock).toHaveBeenCalledTimes(1);
                done();
              });
          });
        });

        describe.each([
          [false, true, true],
          [true, false, true],
          [true, true, false],
        ])('when connection.open resolved? = %o, connection.createReceiver resolved? = %o, activate resolved? = %o',
        (isConnOpenResolved, isConnCreateReceiverResolved, isActivateResolved) => {
          it('fails consuming', (done) => {
             jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isConnOpenResolved) {
                  resolve();
                } else {
                  reject(new Error('connection.open rejected'));
                }
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isConnCreateReceiverResolved) {
                  resolve(new EventEmitter());
                } else {
                  reject(new Error('connection.createReceiver rejected'));
                }
              }));
              activateMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isActivateResolved) {
                  resolve();
                } else {
                  reject(new Error('activate rejected'));
                }
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                done.fail();
              })
              .catch(() => {
                expect(true).toBeTruthy();
              })
              .finally(() => {
                expect(ConnectionMock).toHaveBeenCalledTimes(1);
                expect(connOpenMock).toHaveBeenCalledTimes(1);
                if (isConnOpenResolved) {
                  expect(connCreateReceiverMock).toHaveBeenCalledTimes(queueDefs.length);
                  if (isConnCreateReceiverResolved) {
                    expect(activateMock).toHaveBeenCalledTimes(1);
                  } else {
                    expect(activateMock).not.toHaveBeenCalled();
                  }
                } else {
                  expect(connCreateReceiverMock).not.toHaveBeenCalled();
                  expect(activateMock).not.toHaveBeenCalled();
                }
                done();
              });
          });
        });
      });

      describe.each([
        [{ body: '{"attrs":{"temperature":22.5}}'}],
        [{ body: { content: Buffer.from('{"attrs":{"temperature":22.5}}')}}],
        [{ body: Buffer.from('{"attrs":{"temperature":22.5}}')}],
      ])('when receives attrs message (%o)', (rawMessage) => {
        beforeEach(() => {
          process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
        });

        afterEach(() => {
          delete process.env.QUEUE_DEFS;
        });

        describe.each([
          ['when sendAttribures resolved', 'send attriubtes successfully and accepts context.delivery', true, true],
          ['when sendAttribures rejected', 'failed sending attritues and releases context.delivery', false, true],
          ['when sendAttribures resolved but context has no delivery', 'send attributes successfully and nothing to do for delivery', true, false],
          ['when sendAttribures rejected but context has no delivery', 'failed sending attributes and nothing to do for delivery', false, false],
        ])('%s', (_, desc, isResolved, hasDelivery) => {
          it(desc, (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(receiver);
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              sendAttributesMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isResolved) {
                  resolve();
                } else {
                  reject(new Error('sendAttributes rejected'));
                }
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                if (hasDelivery) {
                  receiver.emit(ReceiverEvents.message, {
                    message: rawMessage,
                    delivery: {
                      accept: deliveryAcceptMock,
                      release: deliveryReleaseMock,
                      reject: deliveryRejectMock,
                    },
                  });
                } else {
                  receiver.emit(ReceiverEvents.message, { message: rawMessage });
                }
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                expect(sendAttributesMock).toHaveBeenCalledTimes(1);
                expect(setCommandResultMock).not.toHaveBeenCalled();
                expect(sendAttributesMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
                expect(sendAttributesMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
                expect(sendAttributesMock.mock.calls[0][2]).toMatchObject({ temperature: 22.5 });
                if (hasDelivery) {
                  if (isResolved) {
                    expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  } else {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).toHaveBeenCalledTimes(1);
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  }
                } else {
                  expect(deliveryAcceptMock).not.toHaveBeenCalled();
                  expect(deliveryReleaseMock).not.toHaveBeenCalled();
                  expect(deliveryRejectMock).not.toHaveBeenCalled();
                }
                done();
              });
          });
        });
      });

      describe.each([
        [{ body: '{"cmdexe":{"open":"window1"}}'}],
        [{ body: { content: Buffer.from('{"cmdexe":{"open":"window1"}}')}}],
        [{ body: Buffer.from('{"cmdexe":{"open":"window1"}}')}],
      ])('when receives cmdexe message (%o)', (rawMessage) => {
        beforeEach(() => {
          process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
        });

        afterEach(() => {
          delete process.env.QUEUE_DEFS;
        });

        describe.each([
          ['when setCommandResult resolved', 'send cmdexe successfully and accepts context.delivery', true, true],
          ['when setCommandResult rejected', 'failed sending cmdexe and releases context.delivery', false, true],
          ['when setCommandResult resolved but context has no delivery', 'send cmdexe successfully and nothing to do for delivery', true, false],
          ['when setCommandResult rejected but context has no delivery', 'failed sending cmdexe and nothing to do for delivery', false, false],
        ])('%s', (_, desc, isResolved, hasDelivery) => {
          it(desc, (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(receiver);
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              setCommandResultMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isResolved) {
                  resolve();
                } else {
                  reject(new Error('setCommandResult rejected'));
                }
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                if (hasDelivery) {
                  receiver.emit(ReceiverEvents.message, {
                    message: rawMessage,
                    delivery: {
                      accept: deliveryAcceptMock,
                      release: deliveryReleaseMock,
                      reject: deliveryRejectMock,
                    },
                  });
                } else {
                  receiver.emit(ReceiverEvents.message, { message: rawMessage });
                }
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                expect(sendAttributesMock).not.toHaveBeenCalled();
                expect(setCommandResultMock).toHaveBeenCalledTimes(1);
                expect(setCommandResultMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
                expect(setCommandResultMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
                expect(setCommandResultMock.mock.calls[0][2]).toMatchObject({ open: 'window1' });
                if (hasDelivery) {
                  if (isResolved) {
                    expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  } else {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).toHaveBeenCalledTimes(1);
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  }
                } else {
                  expect(deliveryAcceptMock).not.toHaveBeenCalled();
                  expect(deliveryReleaseMock).not.toHaveBeenCalled();
                  expect(deliveryRejectMock).not.toHaveBeenCalled();
                }
                done();
              });
          });
        });
      });

      describe.each([
        [{ body: '{"cmd":{"open":"window1"}}' }],
        [{ body: { content: Buffer.from('{"cmd":{"open":"window1"}}') } }],
        [{ body: Buffer.from('{"cmd":{"open":"window1"}}') }],
        [{ body: '{"unknown":""}' }],
        [{ body: { content: Buffer.from('{"unknown":""}') } }],
        [{ body: Buffer.from('{"unknown":""}') }],
        [{ body: '{"cmdexe":{"open":"window1"}' }],
        [{ wxyz: '{"cmdexe":{"open":"window1"}}'}],
        [{ body: '[{"type":"t01","id":"i01"}]' }],
        [{}],
      ])('when receives unexpected message (%o)', (rawMessage) => {
        beforeEach(() => {
          process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
        });

        afterEach(() => {
          delete process.env.QUEUE_DEFS;
        });

        describe.each([
          ['when context has delivery', 'reject context.delivery', true],
          ['when context has no delivery', 'nothing to do for delivery', false],
        ])('%s', (_, desc, hasDelivery) => {
          it(desc, (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(receiver);
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                if (hasDelivery) {
                  receiver.emit(ReceiverEvents.message, {
                    message: rawMessage,
                    delivery: {
                      accept: deliveryAcceptMock,
                      release: deliveryReleaseMock,
                      reject: deliveryRejectMock,
                    },
                  });
                } else {
                  receiver.emit(ReceiverEvents.message, { message: rawMessage });
                }
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                expect(sendAttributesMock).not.toHaveBeenCalled();
                expect(setCommandResultMock).not.toHaveBeenCalled();
                if (hasDelivery) {
                  expect(deliveryAcceptMock).not.toHaveBeenCalled();
                  expect(deliveryReleaseMock).not.toHaveBeenCalled();
                  expect(deliveryRejectMock).toHaveBeenCalledTimes(1);
                } else {
                  expect(deliveryAcceptMock).not.toHaveBeenCalled();
                  expect(deliveryReleaseMock).not.toHaveBeenCalled();
                  expect(deliveryRejectMock).not.toHaveBeenCalled();
                }
                done();
              });
          });
        });
      });

      describe('when receives no message context', () => {
        beforeEach(() => {
          process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
        });

        afterEach(() => {
          delete process.env.QUEUE_DEFS;
        });

        describe.each([
          ['when context has delivery', 'reject context.delivery', true],
          ['when context has no delivery', 'nothing to do for delivery', false],
        ])('%s', (_, desc, hasDelivery) => {
          it(desc, (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(receiver);
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                if (hasDelivery) {
                  receiver.emit(ReceiverEvents.message, {
                    delivery: {
                      accept: deliveryAcceptMock,
                      release: deliveryReleaseMock,
                      reject: deliveryRejectMock,
                    },
                  });
                } else {
                  receiver.emit(ReceiverEvents.message, {});
                }
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                expect(sendAttributesMock).not.toHaveBeenCalled();
                expect(setCommandResultMock).not.toHaveBeenCalled();
                if (hasDelivery) {
                  expect(deliveryAcceptMock).not.toHaveBeenCalled();
                  expect(deliveryReleaseMock).not.toHaveBeenCalled();
                  expect(deliveryRejectMock).toHaveBeenCalledTimes(1);
                } else {
                  expect(deliveryAcceptMock).not.toHaveBeenCalled();
                  expect(deliveryReleaseMock).not.toHaveBeenCalled();
                  expect(deliveryRejectMock).not.toHaveBeenCalled();
                }
                done();
              });
          });
        });
      });

      describe.each([
        [null, [new Entity('type0', 'id0')]],
        ['[{"type":"t01","id":"i01"},{"type":"t02","id":"i02","foo":"bar"}]', [new Entity('t01', 'i01'), new Entity('t02', 'i02')]],
      ])('when the QUEUE_DEFS enviroment variable is %s', (entitiesStr, entities) => {
        beforeEach(() => {
          if (entitiesStr !== null) process.env.QUEUE_DEFS = entitiesStr;
        });

        afterEach(() => {
          if (entitiesStr !== null) delete process.env.QUEUE_DEFS;
        });

        describe('when deactivate resolve, receiver.close resilved and connection.close resolved', () => {
          it('consumer.close successfully', (done) => {
            const receiver = {
              on: jest.fn(),
              close: receiverCloseMock,
            };
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(receiver);
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              deactivateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              receiverCloseMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCloseMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            (async (): Promise<void> => {
              await consumer.consume();
              await consumer.close();
            })()
              .then(() => {
                expect(true).toBeTruthy();
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                process.nextTick(() => {
                  expect(ConnectionMock).toHaveBeenCalledTimes(1);
                  expect(connOpenMock).toHaveBeenCalledTimes(1);
                  expect(connCreateReceiverMock).toHaveBeenCalledTimes(entities.length);
                  expect(activateMock).toHaveBeenCalledTimes(1);
                  expect(deactivateMock).toHaveBeenCalledTimes(1);
                  expect(receiverCloseMock).toHaveBeenCalledTimes(entities.length);
                  expect(connCloseMock).toHaveBeenCalledTimes(1);
                  done();
                });
              });
          });
        });

        describe.each([
          [false, true, true],
          [true, false, true],
          [true, true, false],
        ])('when deactivate resolved? = %o, receiver.close resolved? = %o, connection.close resolved? = %o',
        (isDeactivateResolved, isReceiverCloseResolved, isConnCloseResolved) => {
          it('fails consumer.close', (done) => {
            const receiver = {
              on: jest.fn(),
              close: receiverCloseMock,
            };
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => {
                resolve(receiver);
              }));
              activateMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              deactivateMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isDeactivateResolved) {
                  resolve();
                } else {
                  reject(new Error('deactivate rejected'));
                }
              }));
              receiverCloseMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isReceiverCloseResolved) {
                  resolve();
                } else {
                  reject(new Error('receiver.close rejected'));
                }
              }));
              connCloseMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isConnCloseResolved) {
                  resolve();
                } else {
                  reject(new Error('connection.close rejected'));
                }
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            (async (): Promise<void> => {
              await consumer.consume();
              await consumer.close();
            })()
              .then(() => {
                done.fail();
              })
              .catch(() => {
                expect(true).toBeTruthy();
              })
              .finally(() => {
                process.nextTick(() => {
                  expect(ConnectionMock).toHaveBeenCalledTimes(1);
                  expect(connOpenMock).toHaveBeenCalledTimes(1);
                  expect(connCreateReceiverMock).toHaveBeenCalledTimes(entities.length);
                  expect(activateMock).toHaveBeenCalledTimes(1);
                  expect(deactivateMock).toHaveBeenCalledTimes(1);
                  if (isDeactivateResolved) {
                    expect(receiverCloseMock).toHaveBeenCalledTimes(entities.length);
                    if (isReceiverCloseResolved) {
                      expect(connCloseMock).toHaveBeenCalledTimes(1);
                    } else {
                      expect(connCloseMock).not.toHaveBeenCalled();
                    }
                  } else {
                    expect(receiverCloseMock).not.toHaveBeenCalled();
                    expect(connCloseMock).not.toHaveBeenCalled();
                  }
                  done();
                });
              });
          });
        });
      });

      const attrSchema = {
        type: "object",
        required: ["attrs"],
        properties: {
          "attrs": {
            type: "object",
            required: ["temperature"],
            properties: {
              "temperaturea": {
                type: "number"
              }
            }
          }
        }
      };

      const cmdexeSchema = {
        type: "object",
        required: ["cmdexe"],
        properties: {
          "cmdexe": {
            type: "object",
            required: ["open"],
            properties: {
              "open": {
                type: "string"
              }
            }
          }
        }
      }

      const invalidSchema = {
        type: "object",
        required: ["dummy"],
        properties: {
          "dummy": {
            type: "boolean"
          }
        }
      }

      describe.each([
        [[]],
        [['match']],
        [['not match']],
        [['match', 'match']],
        [['match', 'not match']],
        [['not match', 'match']],
        [['not match', 'not match']],
      ])('when json schemas ([%s]) are given', (schemas) => {
        describe.each([
          [{ body: '{"attrs":{"temperature":22.5}}'}],
          [{ body: { content: Buffer.from('{"attrs":{"temperature":22.5}}')}}],
          [{ body: Buffer.from('{"attrs":{"temperature":22.5}}')}],
        ])('when receives attrs message (%o)', (rawMessage) => {
          const cleanups: Function[] = [];

          beforeEach(() => {
            const paths = schemas.map((s) => {
              const tmp = fileSync();
              cleanups.push(tmp.removeCallback);
              if (s === 'match') {
                writeFileSync(tmp.fd, JSON.stringify(attrSchema));
              } else {
                writeFileSync(tmp.fd, JSON.stringify(invalidSchema));
              }
              return tmp.name;
            });
            process.env.SCHEMA_PATHS = JSON.stringify({'t01.i01.up': paths});
            process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
          });

          afterEach(() => {
            cleanups.forEach((c) => c());
            delete process.env.SCHEMA_PATHS;
            delete process.env.QUEUE_DEFS;
          });

          describe.each([
            ['when context has delivery', true],
            ['when context has no delivery', false],
          ])('%s', (_, hasDelivery) => {
            it(`matches the given schema? ${schemas.some((e) => e)}`, (done) => {
              const receiver = new EventEmitter();
              jest.isolateModules(() => {
                connOpenMock.mockReturnValue(new Promise((resolve) => resolve()));
                connCreateReceiverMock.mockReturnValue(new Promise((resolve) => resolve(receiver)));
                activateMock.mockReturnValue(new Promise((resolve) => resolve()));
                sendAttributesMock.mockReturnValue(new Promise((resolve) => resolve()));
                amqp10 = require('@/bindings/amqp10');
              });
              const consumer = new amqp10.Consumer();
              consumer.consume()
                .then(() => {
                  if (hasDelivery) {
                    receiver.emit(ReceiverEvents.message, {
                      message: rawMessage,
                      delivery: {
                        accept: deliveryAcceptMock,
                        release: deliveryReleaseMock,
                        reject: deliveryRejectMock,
                      },
                    });
                  } else {
                    receiver.emit(ReceiverEvents.message, { message: rawMessage });
                  }
                })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                if (schemas.length == 0) {
                  expect(consumer.hasValidator('t01.i01.up')).toBeFalsy();
                } else {
                  expect(consumer.hasValidator('t01.i01.up')).toBeTruthy();
                }
                if (schemas.length == 0 || schemas.some((s) => s === 'match')) {
                  expect(sendAttributesMock).toHaveBeenCalledTimes(1);
                  expect(setCommandResultMock).not.toHaveBeenCalled();
                  expect(sendAttributesMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
                  expect(sendAttributesMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
                  expect(sendAttributesMock.mock.calls[0][2]).toMatchObject({ temperature: 22.5 });
                  if (hasDelivery) {
                    expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  } else {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  }
                } else {
                  expect(sendAttributesMock).not.toHaveBeenCalled();
                  expect(setCommandResultMock).not.toHaveBeenCalled();
                  if (hasDelivery) {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).toHaveBeenCalledTimes(1);
                  } else {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  }
                }
                done();
              });
            });
          });
        });
      });

      describe.each([
        [['broken']],
        [['not found', 'broken']],
        [['valid', 'not found']],
        [['valid', 'not found', 'broken']],
        [['valid', 'broken', 'not found']],
        [['broken', 'valid']],
        [['broken', 'valid', 'not found']],
        [['brokern', 'broken']],
        [['brokern', 'not found', 'broken']],
      ])('when broken json schema (%s) is given', (schemas) => {
        describe.each([
          [{ body: '{"attrs":{"temperature":22.5}}'}],
          [{ body: { content: Buffer.from('{"attrs":{"temperature":22.5}}')}}],
          [{ body: Buffer.from('{"attrs":{"temperature":22.5}}')}],
        ])('when receives attrs message (%o)', (rawMessage) => {
          const cleanups: Function[] = [];

          beforeEach(() => {
            const paths = schemas.map((s) => {
              if (s === 'not found') {
                return '/path/not/found';
              }
              const tmp = fileSync();
              cleanups.push(tmp.removeCallback);
              if (s === 'valid') {
                writeFileSync(tmp.fd, JSON.stringify(attrSchema));
              } else {
                writeFileSync(tmp.fd, '{"}}}');
              }
              return tmp.name;
            });
            process.env.SCHEMA_PATHS = JSON.stringify({'t01.i01.up': paths});
            process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
          });

          afterEach(() => {
            cleanups.forEach((c) => c());
            delete process.env.SCHEMA_PATHS;
            delete process.env.QUEUE_DEFS;
          });

          it(`matches the given schema? ${schemas.some((e) => e)}`, (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => resolve()));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => resolve(receiver)));
              activateMock.mockReturnValue(new Promise((resolve) => resolve()));
              sendAttributesMock.mockReturnValue(new Promise((resolve) => resolve()));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                receiver.emit(ReceiverEvents.message, {
                  message: rawMessage,
                  delivery: {
                    accept: deliveryAcceptMock,
                    release: deliveryReleaseMock,
                    reject: deliveryRejectMock,
                  },
                });
            })
            .catch(() => {
              done.fail();
            })
            .finally(() => {
              expect(consumer.hasValidator('t01.i01.up')).toBeFalsy();
              expect(sendAttributesMock).toHaveBeenCalledTimes(1);
              expect(setCommandResultMock).not.toHaveBeenCalled();
              expect(sendAttributesMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
              expect(sendAttributesMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
              expect(sendAttributesMock.mock.calls[0][2]).toMatchObject({ temperature: 22.5 });
              expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
              expect(deliveryReleaseMock).not.toHaveBeenCalled();
              expect(deliveryRejectMock).not.toHaveBeenCalled();
              done();
            });
          });
        });
      });

      describe.each([
        ['invalid'],
        ['0'],
        ['[}'],
        ['{}'],
      ])('when invalid or broken SCHEMA_PATHS (%s) is given', (schemaPathsStr) => {
        describe.each([
          [{ body: '{"attrs":{"temperature":22.5}}'}],
          [{ body: { content: Buffer.from('{"attrs":{"temperature":22.5}}')}}],
          [{ body: Buffer.from('{"attrs":{"temperature":22.5}}')}],
        ])('when receives attrs message (%o)', (rawMessage) => {
          beforeEach(() => {
            process.env.SCHEMA_PATHS = schemaPathsStr;
            process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
          });

          afterEach(() => {
            delete process.env.SCHEMA_PATHS;
            delete process.env.QUEUE_DEFS;
          });

          it('processes without any validators', (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => resolve()));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => resolve(receiver)));
              activateMock.mockReturnValue(new Promise((resolve) => resolve()));
              sendAttributesMock.mockReturnValue(new Promise((resolve) => resolve()));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                receiver.emit(ReceiverEvents.message, {
                  message: rawMessage,
                  delivery: {
                    accept: deliveryAcceptMock,
                    release: deliveryReleaseMock,
                    reject: deliveryRejectMock,
                  },
                });
            })
            .catch(() => {
              done.fail();
            })
            .finally(() => {
              expect(consumer.hasValidator('t01.i01.up')).toBeFalsy();
              expect(sendAttributesMock).toHaveBeenCalledTimes(1);
              expect(setCommandResultMock).not.toHaveBeenCalled();
              expect(sendAttributesMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
              expect(sendAttributesMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
              expect(sendAttributesMock.mock.calls[0][2]).toMatchObject({ temperature: 22.5 });
              expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
              expect(deliveryReleaseMock).not.toHaveBeenCalled();
              expect(deliveryRejectMock).not.toHaveBeenCalled();
              done();
            });
          });
        });
      });

      describe.each([
        [[]],
        [['match']],
        [['not match']],
        [['match', 'match']],
        [['match', 'not match']],
        [['not match', 'match']],
        [['not match', 'not match']],
      ])('when json schemas ([%s]) are given', (schemas) => {
        describe.each([
          [{ body: '{"cmdexe":{"open":"window1"}}'}],
          [{ body: { content: Buffer.from('{"cmdexe":{"open":"window1"}}')}}],
          [{ body: Buffer.from('{"cmdexe":{"open":"window1"}}')}],
        ])('when receives cmdexe message (%o)', (rawMessage) => {
          const cleanups: Function[] = [];

          beforeEach(() => {
            const paths = schemas.map((s) => {
              const tmp = fileSync();
              cleanups.push(tmp.removeCallback);
              if (s === 'match') {
                writeFileSync(tmp.fd, JSON.stringify(cmdexeSchema));
              } else {
                writeFileSync(tmp.fd, JSON.stringify(invalidSchema));
              }
              return tmp.name;
            });
            process.env.SCHEMA_PATHS = JSON.stringify(paths);
            process.env.SCHEMA_PATHS = JSON.stringify({'t01.i01.up': paths});
            process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
          });

          afterEach(() => {
            cleanups.forEach((c) => c());
            delete process.env.SCHEMA_PATHS;
            delete process.env.QUEUE_DEFS;
          });

          describe.each([
            ['when context has delivery', true],
            ['when context has no delivery', false],
          ])('%s', (_, hasDelivery) => {
            it(`matches the given schema? ${schemas.some((e) => e)}`, (done) => {
              const receiver = new EventEmitter();
              jest.isolateModules(() => {
                connOpenMock.mockReturnValue(new Promise((resolve) => resolve()));
                connCreateReceiverMock.mockReturnValue(new Promise((resolve) => resolve(receiver)));
                activateMock.mockReturnValue(new Promise((resolve) => resolve()));
                setCommandResultMock.mockReturnValue(new Promise((resolve) => resolve()));
                amqp10 = require('@/bindings/amqp10');
              });
              const consumer = new amqp10.Consumer();
              consumer.consume()
                .then(() => {
                  if (hasDelivery) {
                    receiver.emit(ReceiverEvents.message, {
                      message: rawMessage,
                      delivery: {
                        accept: deliveryAcceptMock,
                        release: deliveryReleaseMock,
                        reject: deliveryRejectMock,
                      },
                    });
                  } else {
                    receiver.emit(ReceiverEvents.message, { message: rawMessage });
                  }
                })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                if (schemas.length == 0) {
                  expect(consumer.hasValidator('t01.i01.up')).toBeFalsy();
                } else {
                  expect(consumer.hasValidator('t01.i01.up')).toBeTruthy();
                }
                if (schemas.length == 0 || schemas.some((s) => s === 'match')) {
                  expect(sendAttributesMock).not.toHaveBeenCalled();
                  expect(setCommandResultMock).toHaveBeenCalledTimes(1);
                  expect(setCommandResultMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
                  expect(setCommandResultMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
                  expect(setCommandResultMock.mock.calls[0][2]).toMatchObject({ open: 'window1' });
                  if (hasDelivery) {
                    expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  } else {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  }
                } else {
                  expect(sendAttributesMock).not.toHaveBeenCalled();
                  expect(setCommandResultMock).not.toHaveBeenCalled();
                  if (hasDelivery) {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).toHaveBeenCalledTimes(1);
                  } else {
                    expect(deliveryAcceptMock).not.toHaveBeenCalled();
                    expect(deliveryReleaseMock).not.toHaveBeenCalled();
                    expect(deliveryRejectMock).not.toHaveBeenCalled();
                  }
                }
                done();
              });
            });
          });
        });
      });

      describe.each([
        [['broken']],
        [['not found', 'broken']],
        [['valid', 'not found']],
        [['valid', 'not found', 'broken']],
        [['valid', 'broken', 'not found']],
        [['broken', 'valid']],
        [['broken', 'valid', 'not found']],
        [['brokern', 'broken']],
        [['brokern', 'not found', 'broken']],
      ])('when broken json schema (%s) is given', (schemas) => {
        describe.each([
          [{ body: '{"cmdexe":{"open":"window1"}}'}],
          [{ body: { content: Buffer.from('{"cmdexe":{"open":"window1"}}')}}],
          [{ body: Buffer.from('{"cmdexe":{"open":"window1"}}')}],
        ])('when receives cmdexe message (%o)', (rawMessage) => {
          const cleanups: Function[] = [];

          beforeEach(() => {
            const paths = schemas.map((s) => {
              if (s === 'not found') {
                return '/path/not/found';
              }
              const tmp = fileSync();
              cleanups.push(tmp.removeCallback);
              if (s === 'valid') {
                writeFileSync(tmp.fd, JSON.stringify(cmdexeSchema));
              } else {
                writeFileSync(tmp.fd, '{"}}}');
              }
              return tmp.name;
            });
            process.env.SCHEMA_PATHS = JSON.stringify(paths);
            process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
          });

          afterEach(() => {
            cleanups.forEach((c) => c());
            delete process.env.SCHEMA_PATHS;
            delete process.env.QUEUE_DEFS;
          });

          it(`matches the given schema? ${schemas.some((e) => e)}`, (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => resolve()));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => resolve(receiver)));
              activateMock.mockReturnValue(new Promise((resolve) => resolve()));
              setCommandResultMock.mockReturnValue(new Promise((resolve) => resolve()));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                receiver.emit(ReceiverEvents.message, {
                  message: rawMessage,
                  delivery: {
                    accept: deliveryAcceptMock,
                    release: deliveryReleaseMock,
                    reject: deliveryRejectMock,
                  },
                });
            })
            .catch(() => {
              done.fail();
            })
            .finally(() => {
              expect(consumer.hasValidator()).toBeFalsy();
              expect(sendAttributesMock).not.toHaveBeenCalledTimes(1);
              expect(setCommandResultMock).toHaveBeenCalledTimes(1);
              expect(setCommandResultMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
              expect(setCommandResultMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
              expect(setCommandResultMock.mock.calls[0][2]).toMatchObject({ open: 'window1' });
              expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
              expect(deliveryReleaseMock).not.toHaveBeenCalled();
              expect(deliveryRejectMock).not.toHaveBeenCalled();
              done();
            });
          });
        });
      });

      describe.each([
        ['invalid'],
        ['0'],
        ['[}'],
        ['{}'],
      ])('when invalid or broken SCHEMA_PATHS (%s) is given', (schemaPathsStr) => {
        describe.each([
          [{ body: '{"cmdexe":{"open":"window1"}}'}],
          [{ body: { content: Buffer.from('{"cmdexe":{"open":"window1"}}')}}],
          [{ body: Buffer.from('{"cmdexe":{"open":"window1"}}')}],
        ])('when receives cmdexe message (%o)', (rawMessage) => {
          beforeEach(() => {
            process.env.SCHEMA_PATHS = schemaPathsStr;
            process.env.QUEUE_DEFS = '[{"type":"t01","id":"i01"}]';
          });

          afterEach(() => {
            delete process.env.SCHEMA_PATHS;
            delete process.env.QUEUE_DEFS;
          });

          it('processes without any validators', (done) => {
            const receiver = new EventEmitter();
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => resolve()));
              connCreateReceiverMock.mockReturnValue(new Promise((resolve) => resolve(receiver)));
              activateMock.mockReturnValue(new Promise((resolve) => resolve()));
              sendAttributesMock.mockReturnValue(new Promise((resolve) => resolve()));
              setCommandResultMock.mockReturnValue(new Promise((resolve) => resolve()));
              amqp10 = require('@/bindings/amqp10');
            });
            const consumer = new amqp10.Consumer();
            consumer.consume()
              .then(() => {
                receiver.emit(ReceiverEvents.message, {
                  message: rawMessage,
                  delivery: {
                    accept: deliveryAcceptMock,
                    release: deliveryReleaseMock,
                    reject: deliveryRejectMock,
                  },
                });
            })
            .catch(() => {
              done.fail();
            })
            .finally(() => {
              expect(consumer.hasValidator()).toBeFalsy();
              expect(sendAttributesMock).not.toHaveBeenCalledTimes(1);
              expect(setCommandResultMock).toHaveBeenCalledTimes(1);
              expect(setCommandResultMock.mock.calls[0][0]).toMatchObject(new QueueDef('t01', 'i01'));
              expect(setCommandResultMock.mock.calls[0][1]).toMatchObject(new Entity('t01', 'i01'));
              expect(setCommandResultMock.mock.calls[0][2]).toMatchObject({ open: 'window1' });
              expect(deliveryAcceptMock).toHaveBeenCalledTimes(1);
              expect(deliveryReleaseMock).not.toHaveBeenCalled();
              expect(deliveryRejectMock).not.toHaveBeenCalled();
              done();
            });
          });
        });
      });

    });

    describe('Producer', () => {
      beforeEach(() => {
        ConnectionMock.mockImplementation(() => {
          return {
            open: connOpenMock,
            close: connCloseMock,
            createAwaitableSender: connCreateAwaitableSenderMock,
          }
        });
      });

      describe.each([
        ['{"open":"window1"}', { open: 'window1' }],
        ['{}', {}],
        ['[1, "a"]', [1, 'a']],
        ['abc', 'abc'],
        ['123', 123],
      ])('when data is %s', (_, data) => {
        const queueDef = new QueueDef('t01', 'i01');
        const did = 9;

        describe('when connection.open resolved, connection.createAwaitableSender resolved', () => {
          it('produces successfully', (done) => {
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateAwaitableSenderMock.mockReturnValue(new Promise((resolve) => {
                resolve({
                  send: senderSendMock,
                  close: senderCloseMock,
                });
              }));
              senderSendMock.mockReturnValue(new Promise((resolve) => {
                resolve({ id: did });
              }));
              senderCloseMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const producer = new amqp10.Producer();
            producer.produce(queueDef, data)
              .then((deliveryId: number) => {
                expect(deliveryId).toBe(did);
              })
              .catch(() => {
                done.fail();
              })
              .finally(() => {
                expect(ConnectionMock).toHaveBeenCalledTimes(1);
                expect(connOpenMock).toHaveBeenCalledTimes(1);
                expect(connCreateAwaitableSenderMock).toHaveBeenCalledTimes(1);
                expect(connCreateAwaitableSenderMock).toHaveBeenCalledWith({
                  target: {
                    address: queueDef.downstreamQueue,
                  }
                });
                expect(senderSendMock).toHaveBeenCalledTimes(1);
                expect(senderSendMock).toHaveBeenCalledWith({
                  body: JSON.stringify({ cmd: data }),
                });
                expect(senderCloseMock).toHaveBeenCalledTimes(1);
                done();
              });
          });
        });
      });

      describe.each([
        ['{"open":"window1"}', { open: 'window1' }],
      ])('when data is %s', (_, data) => {
        const queueDef = new QueueDef('t01', 'i01');
        const did = 9;

        describe.each([
          [false, true, true, true],
          [true, false, true, true],
          [true, true, false, true],
          [true, true, true, false],
        ])('when connection.open resolved? = %o, connection.createAwaitableSender resolved? = %o, sender.send resolved? = %o, sender.close resolved? = %o',
        (isConnOpenResolved, isConnCreateAwaitableSenderResolved, isSenderSendResolved, isSenderCloseResolved) => {
          it('fails producing', (done) => {
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isConnOpenResolved) {
                  resolve();
                } else {
                  reject(new Error('connection.open rejected'));
                }
              }));
              connCreateAwaitableSenderMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isConnCreateAwaitableSenderResolved) {
                  resolve({
                    send: senderSendMock,
                    close: senderCloseMock,
                  });
                } else {
                  reject(new Error('connection.createAwaitableSender rejected'));
                }
              }));
              senderSendMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isSenderSendResolved) {
                  resolve({ id: did });
                } else {
                  reject(new Error('sender.send rejectted'));
                }
              }));
              senderCloseMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isSenderCloseResolved) {
                  resolve();
                } else {
                  reject(new Error('sender.close rejected'));
                }
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const producer = new amqp10.Producer();
            producer.produce(queueDef, data)
              .then(() => {
                done.fail();
              })
              .catch(() => {
                expect(true).toBeTruthy();
              })
              .finally(() => {
                expect(ConnectionMock).toHaveBeenCalledTimes(1);
                expect(connOpenMock).toHaveBeenCalledTimes(1);
                if (isConnOpenResolved) {
                  expect(connCreateAwaitableSenderMock).toHaveBeenCalledTimes(1);
                  if (isConnCreateAwaitableSenderResolved) {
                    expect(senderSendMock).toHaveBeenCalledTimes(1);
                    if (isSenderSendResolved) {
                      expect(senderCloseMock).toHaveBeenCalledTimes(1);
                    } else {
                      expect(senderCloseMock).not.toHaveBeenCalled();
                    }
                  } else {
                    expect(senderSendMock).not.toHaveBeenCalled();
                    expect(senderCloseMock).not.toHaveBeenCalled();
                  }
                } else {
                  expect(connCreateAwaitableSenderMock).not.toHaveBeenCalled();
                  expect(senderSendMock).not.toHaveBeenCalled();
                  expect(senderCloseMock).not.toHaveBeenCalled();
                }
                done();
              });
          });
        });
      });

      describe.each([
        ['{"open":"window1"}', { open: 'window1' }],
      ])('when data is %s', (_, data) => {
        const queueDef = new QueueDef('t01', 'i01');
        const did = 9;

        describe.each([
          [true, 'producer.close successfully'],
          [false, 'fails producer.close'],
        ])('when connection.close resolved? = %o', (isConnCloseResolved, desc) => {
          it(desc, (done) => {
            jest.isolateModules(() => {
              connOpenMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCreateAwaitableSenderMock.mockReturnValue(new Promise((resolve) => {
                resolve({
                  send: senderSendMock,
                  close: senderCloseMock,
                });
              }));
              senderSendMock.mockReturnValue(new Promise((resolve) => {
                resolve({ id: did });
              }));
              senderCloseMock.mockReturnValue(new Promise((resolve) => {
                resolve();
              }));
              connCloseMock.mockReturnValue(new Promise((resolve, reject) => {
                if (isConnCloseResolved) {
                  resolve();
                } else {
                  reject(new Error('connection.close rejected'));
                }
              }));
              amqp10 = require('@/bindings/amqp10');
            });
            const producer = new amqp10.Producer();
            (async (): Promise<void> => {
              const deliveryId = await producer.produce(queueDef, data)
              expect(deliveryId).toBe(did);
              await producer.close();
            })()
              .then(() => {
                if (!isConnCloseResolved) done.fail();
              })
              .catch(() => {
                if (isConnCloseResolved) done.fail();
              })
              .finally(() => {
                process.nextTick(() => {
                  expect(ConnectionMock).toHaveBeenCalledTimes(1);
                  expect(connOpenMock).toHaveBeenCalledTimes(1);
                  expect(connCreateAwaitableSenderMock).toHaveBeenCalledTimes(1);
                  expect(senderSendMock).toHaveBeenCalledTimes(1);
                  expect(senderCloseMock).toHaveBeenCalledTimes(1);
                  expect(connCloseMock).toHaveBeenCalledTimes(1);
                  done();
                });
              });
          });
        });
      });

    });
  });
});