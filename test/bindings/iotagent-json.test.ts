/* eslint-disable @typescript-eslint/camelcase */
import axios from 'axios';
import { QueueDef, Entity } from '@/common';

jest.mock('axios');
const getMock = axios.get as jest.Mock;
const postMock = axios.post as jest.Mock;

describe('/bindings/iotagent-json', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let iotaJson: any;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('sendAttributes', () => {
    describe.each([
      [null, null, null, null, null],
      ['iot.example.com', '27896', '24041', 'fservice', '/fpath'],
    ])('when environment vairables is like this (IOTA_HOST=%s, IOTA_DATA_PORT=%s, IOTA_MANAGE_PORT=%s, FIWARE_SERICE=%s, FIWARE_SERVICEPATH=%s',
    (iotaHost, iotaDataPort, iotaManagePort, fiwareService, fiwareServicePath) => {
      afterEach(() => {
        if (iotaHost !== null) delete process.env.IOTA_HOST;
        if (iotaDataPort !== null) delete process.env.IOTA_DATA_PORT;
        if (iotaManagePort !== null) delete process.env.IOTA_MANAGE_PORT;
        if (fiwareService !== null) delete process.env.FIWARE_SERVICE;
        if (fiwareServicePath !== null) delete process.env.FIWARE_SERVICEPATH;
      });

      describe.each([
        ['when posted data to iotagent successfully', true, 'resolves'],
        ['when failed posting data to iotagent', false, 'rejects'],
      ])('%s', (_, isResolved, desc) => {
        describe.each([
          [{ temperature: 25.1 }],
          [undefined],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ])('', (data?: any) => {
          describe.each([
            ['t01', 'i01', 'qdi01', 'fs', 'fsp'],
            ['t01', 'i01', undefined, 'fs', 'fsp'],
            ['t01', 'i01', undefined, undefined, 'fsp'],
            ['t01', 'i01', undefined, undefined, undefined],
          ])('', (type, id, qdid, fsa, fspa) => {
            it(`${desc} data=${JSON.stringify(data)}, QueueDef(type=${type}, id=${qdid}, fiwareServcie=${fsa}, fiwareServciePath=${fspa})`, (done) => {
              jest.isolateModules(() => {
                if (iotaHost !== null) process.env.IOTA_HOST = iotaHost;
                if (iotaDataPort !== null) process.env.IOTA_DATA_PORT = iotaDataPort;
                if (iotaManagePort !== null) process.env.IOTA_MANAGE_PORT = iotaManagePort;
                if (fiwareService !== null) process.env.FIWARE_SERVICE = fiwareService;
                if (fiwareServicePath !== null) process.env.FIWARE_SERVICEPATH = fiwareServicePath;

                if (isResolved) {
                  postMock.mockResolvedValue({ status: 200 });
                } else {
                  postMock.mockRejectedValue(new Error('rejected'));
                }
                iotaJson = require('@/bindings/iotagent-json');
              });
              const entity = new Entity(type, id);
              const queueDef = new QueueDef(type, qdid, fsa, fspa);
              iotaJson.sendAttributes(queueDef, entity, data)
                .then((status: number) => {
                  if (!isResolved) done.fail();
                  expect(status).toBe(200);
                })
                .catch(() => {
                  if (isResolved) done.fail();
                })
                .finally(() => {
                  expect(getMock).not.toHaveBeenCalled();
                  expect(postMock).toHaveBeenCalledTimes(1);
                  const url = `http://${(iotaHost) ? iotaHost : 'localhost'}:${(iotaDataPort) ? iotaDataPort : '7896'}/iot/json?k=${type}&i=${id}`;
                  expect(postMock.mock.calls[0][0]).toBe(url);
                  if (data !== undefined) {
                    expect(postMock.mock.calls[0][1]).toMatchObject(data);
                  } else {
                    expect(postMock.mock.calls[0][1]).toBeUndefined();
                  }
                  expect(postMock.mock.calls[0][2]).toMatchObject({
                    headers: {
                      'Fiware-Service': (fsa) ? fsa: (fiwareService) ? fiwareService : '',
                      'Fiware-ServicePath': (fspa) ? fspa : (fiwareServicePath) ? fiwareServicePath : '/',
                      'Content-Type': 'application/json',
                    }
                  });
                  done();
                });
            });
          });
        });
      });
    });
  });

  describe('getServices', () => {
    describe.each([
      [null, null, null, null, null],
      ['iot.example.com', '27896', '24041', 'fservice', '/fpath'],
    ])('when environment vairables is like this (IOTA_HOST=%s, IOTA_DATA_PORT=%s, IOTA_MANAGE_PORT=%s, FIWARE_SERICE=%s, FIWARE_SERVICEPATH=%s',
    (iotaHost, iotaDataPort, iotaManagePort, fiwareService, fiwareServicePath) => {
      afterEach(() => {
        if (iotaHost !== null) delete process.env.IOTA_HOST;
        if (iotaDataPort !== null) delete process.env.IOTA_DATA_PORT;
        if (iotaManagePort !== null) delete process.env.IOTA_MANAGE_PORT;
        if (fiwareService !== null) delete process.env.FIWARE_SERVICE;
        if (fiwareServicePath !== null) delete process.env.FIWARE_SERVICEPATH;
      });

      describe.each([
        ['when got data to iotagent successfully', true, 'resolves'],
        ['when failed getting data to iotagent', false, 'rejects'],
      ])('%s', (_, isResolved, desc) => {
        describe.each([
          [
            { services: [] },
            [],
          ],
          [
            { services: [
              { _id: '_01', resource: 'resource01', apiKey: 'apiKey01', service: 'service01', subservice: 'subservice01', entity_type: 'entityType01' },
            ] },
            [
              { _id: '_01', resource: 'resource01', apiKey: 'apiKey01', service: 'service01', subservice: 'subservice01', entity_type: 'entityType01' },
            ]
          ],
          [
            { services: [
              { _id: '_01', resource: 'resource01', apiKey: 'apiKey01', service: 'service01', subservice: 'subservice01', entity_type: 'entityType01' },
              { _id: '_02', resource: 'resource02', apiKey: 'apiKey02', service: 'service02', subservice: 'subservice02', entity_type: 'entityType02' },
            ] },
            [
              { _id: '_01', resource: 'resource01', apiKey: 'apiKey01', service: 'service01', subservice: 'subservice01', entity_type: 'entityType01' },
              { _id: '_02', resource: 'resource02', apiKey: 'apiKey02', service: 'service02', subservice: 'subservice02', entity_type: 'entityType02' },
            ]
          ],
          [
            { _id: '_01', resource: 'resource01', apiKey: 'apiKey01', service: 'service01', subservice: 'subservice01', entity_type: 'entityType01' },
            [],
          ],
          [
            {},
            [],
          ],
          [
            [1, 2, 3],
            [],
          ],
          [
            'abc',
            [],
          ],
          [
            0,
            [],
          ],
          [
            true,
            [],
          ],
        ])('', (data, expected) => {
          describe.each([
            ['t01', 'qdi01', 'fs', 'fsp'],
            ['t01', undefined, 'fs', 'fsp'],
            ['t01', undefined, undefined, 'fsp'],
            ['t01', undefined, undefined, undefined],
          ])('', (type, qdid, fsa, fspa) => {
            const dataStr = JSON.stringify(data);
            it(`${desc} data = ${(dataStr.length <= 36) ? dataStr : dataStr.slice(0, 36) + '...'}, QueueDef(type=${type}, id=${qdid}, fiwareService=${fsa}, fiwareServicePath=${fspa})`, (done) => {
              jest.isolateModules(() => {
                if (iotaHost !== null) process.env.IOTA_HOST = iotaHost;
                if (iotaDataPort !== null) process.env.IOTA_DATA_PORT = iotaDataPort;
                if (iotaManagePort !== null) process.env.IOTA_MANAGE_PORT = iotaManagePort;
                if (fiwareService !== null) process.env.FIWARE_SERVICE = fiwareService;
                if (fiwareServicePath !== null) process.env.FIWARE_SERVICEPATH = fiwareServicePath;

                if (isResolved) {
                  getMock.mockResolvedValue({ data: data });
                } else {
                  getMock.mockRejectedValue(new Error('rejected'));
                }
                iotaJson = require('@/bindings/iotagent-json');
              });
              const queueDef = new QueueDef(type, qdid, fsa, fspa);
              iotaJson.getServices(queueDef)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then((services: any) => {
                  if (!isResolved) done.fail();
                  expect(services).toMatchObject(expected);
                })
                .catch(() => {
                  if (isResolved) done.fail();
                })
                .finally(() => {
                  expect(getMock).toHaveBeenCalledTimes(1);
                  expect(postMock).not.toHaveBeenCalled();
                  const url = `http://${(iotaHost) ? iotaHost : 'localhost'}:${(iotaManagePort) ? iotaManagePort : '4041'}/iot/services`;
                  expect(getMock.mock.calls[0][0]).toBe(url);
                  expect(getMock.mock.calls[0][1]).toMatchObject({
                    headers: {
                      'Fiware-Service': (fsa) ? fsa : (fiwareService) ? fiwareService : '',
                      'Fiware-ServicePath': (fspa) ? fspa : (fiwareServicePath) ? fiwareServicePath : '/',
                    }
                  });
                  done();
                });
            });
          });
        });
      });
    });
  });

  describe('getDevices', () => {
    describe.each([
      [null, null, null, null, null],
      ['iot.example.com', '27896', '24041', 'fservice', '/fpath'],
    ])('when environment vairables is like this (IOTA_HOST=%s, IOTA_DATA_PORT=%s, IOTA_MANAGE_PORT=%s, FIWARE_SERICE=%s, FIWARE_SERVICEPATH=%s',
    (iotaHost, iotaDataPort, iotaManagePort, fiwareService, fiwareServicePath) => {
      afterEach(() => {
        if (iotaHost !== null) delete process.env.IOTA_HOST;
        if (iotaDataPort !== null) delete process.env.IOTA_DATA_PORT;
        if (iotaManagePort !== null) delete process.env.IOTA_MANAGE_PORT;
        if (fiwareService !== null) delete process.env.FIWARE_SERVICE;
        if (fiwareServicePath !== null) delete process.env.FIWARE_SERVICEPATH;
      });

      describe.each([
        ['when got data to iotagent successfully', true, 'resolves'],
        ['when failed getting data to iotagent', false, 'rejects'],
      ])('%s', (_, isResolved, desc) => {
        describe.each([
          [
            { devices: [] },
            [],
          ],
          [
            { devices: [
              { device_id: 'device01', service: 'service01', service_path: 'servicepath01', entity_name: 'entityname01', entity_type: 'entitytype01', attributes: ['a1'], lazy: ['l1'], commands: ['c1'], static_attributes: ['s1'] },
            ] },
            [
              { device_id: 'device01', service: 'service01', service_path: 'servicepath01', entity_name: 'entityname01', entity_type: 'entitytype01', attributes: ['a1'], lazy: ['l1'], commands: ['c1'], static_attributes: ['s1'] },
            ]
          ],
          [
            { devices: [
              { device_id: 'device01', service: 'service01', service_path: 'servicepath01', entity_name: 'entityname01', entity_type: 'entitytype01', attributes: ['a1'], lazy: ['l1'], commands: ['c1'], static_attributes: ['s1'] },
              { device_id: 'device02', service: 'service02', service_path: 'servicepath02', entity_name: 'entityname02', entity_type: 'entitytype02', attributes: ['a2'], lazy: ['l2'], commands: ['c2'], static_attributes: ['s2'] }
            ] },
            [
              { device_id: 'device01', service: 'service01', service_path: 'servicepath01', entity_name: 'entityname01', entity_type: 'entitytype01', attributes: ['a1'], lazy: ['l1'], commands: ['c1'], static_attributes: ['s1'] },
              { device_id: 'device02', service: 'service02', service_path: 'servicepath02', entity_name: 'entityname02', entity_type: 'entitytype02', attributes: ['a2'], lazy: ['l2'], commands: ['c2'], static_attributes: ['s2'] }
            ]
          ],
          [
            { device_id: 'device01', service: 'service01', service_path: 'servicepath01', entity_name: 'entityname01', entity_type: 'entitytype01', attributes: ['a1'], lazy: ['l1'], commands: ['c1'], static_attributes: ['s1'] },
            [],
          ],
          [
            {},
            [],
          ],
          [
            [1, 2, 3],
            [],
          ],
          [
            'abc',
            [],
          ],
          [
            0,
            [],
          ],
          [
            true,
            [],
          ],
        ])('', (data, expected) => {
          describe.each([
            ['t01', 'qdi01', 'fs', 'fsp'],
            ['t01', undefined, 'fs', 'fsp'],
            ['t01', undefined, undefined, 'fsp'],
            ['t01', undefined, undefined, undefined],
          ])('', (type, qdid, fsa, fspa) => {
            const dataStr = JSON.stringify(data);
            it(`${desc} data = ${(dataStr.length <= 36) ? dataStr : dataStr.slice(0, 36) + '...'}`, (done) => {
              jest.isolateModules(() => {
                if (iotaHost !== null) process.env.IOTA_HOST = iotaHost;
                if (iotaDataPort !== null) process.env.IOTA_DATA_PORT = iotaDataPort;
                if (iotaManagePort !== null) process.env.IOTA_MANAGE_PORT = iotaManagePort;
                if (fiwareService !== null) process.env.FIWARE_SERVICE = fiwareService;
                if (fiwareServicePath !== null) process.env.FIWARE_SERVICEPATH = fiwareServicePath;

                if (isResolved) {
                  getMock.mockResolvedValue({ data: data });
                } else {
                  getMock.mockRejectedValue(new Error('rejected'));
                }
                iotaJson = require('@/bindings/iotagent-json');
              });
              const queueDef = new QueueDef(type, qdid, fsa, fspa);
              iotaJson.getDevices(queueDef)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .then((devices: any) => {
                  if (!isResolved) done.fail();
                  expect(devices).toMatchObject(expected);
                })
                .catch(() => {
                  if (isResolved) done.fail();
                })
                .finally(() => {
                  expect(getMock).toHaveBeenCalledTimes(1);
                  expect(postMock).not.toHaveBeenCalled();
                  const url = `http://${(iotaHost) ? iotaHost : 'localhost'}:${(iotaManagePort) ? iotaManagePort : '4041'}/iot/devices`;
                  expect(getMock.mock.calls[0][0]).toBe(url);
                  expect(getMock.mock.calls[0][1]).toMatchObject({
                    headers: {
                      'Fiware-Service': (fsa) ? fsa : (fiwareService) ? fiwareService : '',
                      'Fiware-ServicePath': (fspa) ? fspa : (fiwareServicePath) ? fiwareServicePath : '/',
                    }
                  });
                  done();
                });
            });
          });
        });
      });
    });
  });

});
