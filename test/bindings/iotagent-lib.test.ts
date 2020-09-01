/* eslint-disable @typescript-eslint/camelcase */
import { activate, setCommandResult, deactivate } from 'iotagent-node-lib';
import { getServices, getDevices } from '@/bindings/iotagent-json';
import { QueueDef, Entity, ServiceType, DeviceType, isObject } from '@/common';

jest.mock('iotagent-node-lib');
const activateMock = activate as jest.Mock;
const setCommandResultMock = setCommandResult as jest.Mock;
const deactivateMock = deactivate as jest.Mock;
jest.mock('@/bindings/iotagent-json');
const getServicesMock = getServices as jest.Mock;
const getDevicesMock = getDevices as jest.Mock;


describe('/bindings/iotagent-lib', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('activate', () => {
    describe.each([
      [null, null, null, null, null],
      ['orion.example.com', '21026', 'iot.example.com', '24041', 'v1'],
    ])('when enviroment variables is like this (IOTA_CB_HOST=%s, IOTA_CB_PORT=%s, IOTA_HOST=%s, IOTA_MANAGE_PORT=%s, IOTA_CB_NGSI_VERSION=%s',
    (cbHost, cbPort, iotaHost, iotaManagePort, ngsiVersion) => {
      afterEach(() => {
        if (cbHost !== null) delete process.env.IOTA_CB_HOST;
        if (cbPort !== null) delete process.env.IOTA_CB_PORT;
        if (iotaHost !== null) delete process.env.IOTA_HOST;
        if (iotaManagePort !== null) delete process.env.IOTA_MANAGE_PORT;
        if (ngsiVersion !== null) delete process.env.IOTA_CB_NGSI_VERSION;
      });

      describe.each([
        [true, 'resolves when calling back iotagent-node-lib.activate without error'],
        [false, 'rejects when calling back iotagent-node-lib.activate with error'],
      ])('', (isResolved, desc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let iotaLib: any;
        it(desc, (done) => {
          jest.isolateModules(() => {
            if (cbHost !== null) process.env.IOTA_CB_HOST = cbHost;
            if (cbPort !== null) process.env.IOTA_CB_PORT = cbPort;
            if (iotaHost !== null) process.env.IOTA_HOST = iotaHost;
            if (iotaManagePort !== null) process.env.IOTA_MANAGE_PORT = iotaManagePort;
            if (ngsiVersion !== null) process.env.IOTA_CB_NGSI_VERSION = ngsiVersion;
            activateMock.mockImplementation((_, cb: (err?: unknown | undefined) => Promise<void>): void => {
              if (isResolved) {
                cb();
              } else {
                cb(new Error('error'));
              }
            });
            iotaLib = require('@/bindings/iotagent-lib');
          });
          iotaLib.activate()
            .then(() => {
              if (!isResolved) done.fail();
            })
            .catch(() => {
              if (isResolved) done.fail();
            })
            .finally(() => {
              expect(activateMock).toHaveBeenCalledTimes(1);
              const calledConfig = activateMock.mock.calls[0][0];
              expect(calledConfig.logLevel).toBe('INFO');
              expect(calledConfig.timestamp).toBeTruthy();
              expect(calledConfig.contextBroker).toMatchObject({
                host: (cbHost !== null) ? cbHost : 'localhost',
                port: (cbPort !== null) ? cbPort : '1026',
                ngsiVersion: (ngsiVersion !== null) ? ngsiVersion : 'v2',
              });
              expect(calledConfig.deviceRegistry).toMatchObject({ type: 'memory' });
              expect(calledConfig.types).toMatchObject({});
              const url = `http://${(iotaHost !== null) ? iotaHost : 'localhost'}:${(iotaManagePort !== null) ? iotaManagePort : '4041'}`;
              expect(calledConfig.providerUrl).toBe(url);
              done();
            });
        });
      });
    });
  });

  describe('setCommandResult', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let iotaLib: any;

    beforeEach(() => {
      jest.isolateModules(() => {
        iotaLib = require('@/bindings/iotagent-lib');
      });

      const services: ServiceType[] = [
        {
          _id: '_01',
          resource: 'resource01',
          apikey: 'apikey01',
          service: 'service01',
          subservice: 'subservice01',
          entity_type: 't01',
        },
        {
          _id: '_02',
          resource: 'resource02',
          apikey: 'apikey02',
          service: 'service02',
          subservice: 'subservice02',
          entity_type: 't02',
        }
      ];
      getServicesMock.mockReturnValue(services);

      const devices: DeviceType[] = [
        {
          device_id: 'device01',
          service: 'dservice01',
          service_path: 'dservicepath01',
          entity_name: 'i01',
          entity_type: 't01',
          attributes: ['a01'],
          lazy: ['l01'],
          commands: ['c01'],
          static_attributes: ['s01'],
        },
        {
          device_id: 'device02',
          service: 'dservice02',
          service_path: 'dservicepath02',
          entity_name: 'i02',
          entity_type: 't02',
          attributes: ['a02'],
          lazy: ['l02'],
          commands: ['c02'],
          static_attributes: ['s02'],
        }
      ];
      getDevicesMock.mockReturnValue(devices);
    });

    describe.each([
      [undefined, 'undefined'],
      [null, 'null'],
      ['', ''],
      [[], '[]'],
      [[1, 'a'], '[1, "a"]'],
    ])('when invalid data is given', (data, desc) => {
      it(`rejects data (${desc})`, (done) => {
        const entity = new Entity('t01', 'i01');
        const queueDef = new QueueDef('t01', 'i01');
        iotaLib.setCommandResult(queueDef, entity, data)
          .then(() => {
            done.fail();
          })
          .catch(() => {
            expect(setCommandResultMock).toHaveBeenCalledTimes(0);
            expect(getServicesMock).toHaveBeenCalledTimes(0);
            expect(getDevicesMock).toHaveBeenCalledTimes(0);
            done();
          });
      });
    });

    describe.each([
      [{}, '{}'],
      [{ open: undefined}, '{open: undefined}'],
      [{ open: null}, '{open: null}'],
      [{ open: ''}, '{open: ""}'],
    ])('when empty object is given', (data, desc) => {
      it(`rejects data (${desc})`, (done) => {
        const entity = new Entity('t01', 'i01');
        const queueDef = new QueueDef('t01', 'i01');
        iotaLib.setCommandResult(queueDef, entity, data)
          .then(() => {
            done.fail();
          })
          .catch(() => {
            expect(setCommandResultMock).toHaveBeenCalledTimes(0);
            expect(getServicesMock).toHaveBeenCalledTimes(1);
            expect(getDevicesMock).toHaveBeenCalledTimes(1);
            done();
          });
      });
    });

    describe.each([
      [{ open: 'window1 opened' }, 'open', 'window1 opened'],
      [{ open: { target: 'window1', result: 'opened'} }, 'open', { target: 'window1', result: 'opened' }],
      [{ open: ['window1', 'window2'] }, 'open', ['window1', 'window2']],
    ])('when data (%o) is given', (data, cmdName, cmdResult) => {
      describe.each([
        [true, 'resolves when calling back iotagent-node-lib.setCommandResult without error'],
        [false, 'rejects when calling back iotagent-node-lib.setCommandResult with error'],
      ])('', (isResolved, desc) => {
        it(desc, (done) => {
          setCommandResultMock.mockImplementation((_a, _b, _c, _d, _e, _f, _g, cb: (err? : unknown | undefined) => Promise<void>): void => {
            if (isResolved) {
              cb();
            } else {
              cb(new Error('error'));
            }
          });

          const entity = new Entity('t02', 'i02');
          const queueDef = new QueueDef('t01', 'i01');
          iotaLib.setCommandResult(queueDef, entity, data)
            .then(() => {
              if (!isResolved) done.fail();
            })
            .catch(() => {
              if (isResolved) done.fail();
            })
            .finally(() => {
              expect(setCommandResultMock).toHaveBeenCalledTimes(1);
              expect(setCommandResultMock.mock.calls[0][0]).toBe('i02');
              expect(setCommandResultMock.mock.calls[0][1]).toBe('resource02');
              expect(setCommandResultMock.mock.calls[0][2]).toBe('apikey02');
              expect(setCommandResultMock.mock.calls[0][3]).toBe(cmdName);
              if (isObject(cmdResult)) {
                expect(setCommandResultMock.mock.calls[0][4]).toMatchObject(cmdResult);
              } else {
                expect(setCommandResultMock.mock.calls[0][4]).toBe(cmdResult);
              }
              expect(setCommandResultMock.mock.calls[0][5]).toBe('OK');
              expect(setCommandResultMock.mock.calls[0][6]).toMatchObject({
                type: 't02',
                id: 'i02',
                service: 'service02',
                subservice: 'subservice02',
                commands: ['c02'],
              });
              expect(getServicesMock).toHaveBeenCalledTimes(1);
              expect(getDevicesMock).toHaveBeenCalledTimes(1);

              // call setCommandResult again
              // service and device is cached, so getServices and getDevices does not call again
              iotaLib.setCommandResult(queueDef, entity, data)
                .then(() => {
                  if (!isResolved) done.fail();
                })
                .catch(() => {
                  if (isResolved) done.fail();
                })
                .finally(() => {
                  expect(setCommandResultMock).toHaveBeenCalledTimes(2);
                  expect(getServicesMock).toHaveBeenCalledTimes(1);
                  expect(getDevicesMock).toHaveBeenCalledTimes(1);
                  done();
                });
            });
        });
      });
    });

    describe.each([
      ['notexist', 'notexist', 1, 0],
      ['notexist', 'i01', 1, 0],
      ['t01', 'notexist', 1, 1],
    ])('when entity does not match Services or Devices', (type, id, getServicesCallTimes, getDevicesCallTimes) => {
      it(`rejects Entity(type=${type}, id=${id})`, (done) => {
        const data = { open: 'window1 opened' };
        const entity = new Entity(type, id);
        const queueDef = new QueueDef('t01', 'i01');
        iotaLib.setCommandResult(queueDef, entity, data)
          .then(() => {
            done.fail();
          })
          .catch(() => {
            expect(setCommandResultMock).toHaveBeenCalledTimes(0);
            expect(getServicesMock).toHaveBeenCalledTimes(getServicesCallTimes);
            expect(getDevicesMock).toHaveBeenCalledTimes(getDevicesCallTimes);
            done();
          });
      });
    });
  });

  describe('deactivate', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let iotaLib: any;

    beforeEach(() => {
      jest.isolateModules(() => {
        iotaLib = require('@/bindings/iotagent-lib');
      });
    });

    describe.each([
      ['when calling back iotagent-node-lib.deactivate without error', true, 'resolves deactivate'],
      ['when calling back iotagent-node-lib.deactivate with error',  false, 'rejects deactivate'],
    ])('%s', (_, isResolved, desc) => {
      it(desc, (done) => {
        deactivateMock.mockImplementation((cb: (err?: unknown | undefined) => Promise<void>): void => {
          if (isResolved) {
            cb();
          } else {
            cb(new Error('error'));
          }
        });
        iotaLib.deactivate()
          .then(() => {
            if (!isResolved) done.fail();
          })
          .catch(() => {
            if (isResolved) done.fail();
          })
          .finally(() => {
            expect(deactivateMock).toHaveBeenCalledTimes(1);
            done();
          });
      });
    });
  });
});