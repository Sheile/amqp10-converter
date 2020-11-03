/* eslint-disable @typescript-eslint/camelcase */
import axios from 'axios';
import { BackendType, QueueDef } from '@/common';

jest.mock('axios');
const getMock = axios.get as jest.Mock;
const patchMock = axios.patch as jest.Mock;
const postMock = axios.post as jest.Mock;

describe('/bindings/orion', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orion: any;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('sendNgsiMessage', () => {
    describe.each([
      [null, null, null, null, null],
      ['orion.example.com', '21026', 'v2', 'fservice', '/fpath'],
    ])('when environment vairables is like this (IOTA_CB_HOST=%s, IOTA_CB_PORT=%s, IOTA_CB_NGSI_VERSION=%s, FIWARE_SERICE=%s, FIWARE_SERVICEPATH=%s',
    (iotaCbHost, iotaCbPort, iotaCbNgsiVersion, fiwareService, fiwareServicePath) => {
      afterEach(() => {
        if (iotaCbHost !== null) delete process.env.IOTA_CB_HOST;
        if (iotaCbPort !== null) delete process.env.IOTA_CB_PORT;
        if (iotaCbNgsiVersion !== null) delete process.env.IOTA_CB_NGSI_VERSION;
        if (fiwareService !== null) delete process.env.FIWARE_SERVICE;
        if (fiwareServicePath !== null) delete process.env.FIWARE_SERVICEPATH;
      });

      describe.each([
        ['when posted new data to orion successfully', true, true, 'resolves'],
        ['when failed posting new data to orion', true, false, 'rejects'],
        ['when update data on orion successfully', false, true, 'resolves'],
        ['when failed updating data on orion', false, false, 'rejects'],
      ])('%s', (_, isNew, isResolved, desc) => {
        describe.each([
          [{
            id: 'urn:ngsi-ld:t01:i01',
            type: 't01',
            temperature: { type: 'Number', value: 25.1 }
          }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ])('', (data?: any) => {
          describe.each([
            ['t01', 'i01', 'qdi01', 'fs', 'fsp', BackendType.orion],
            ['t01', 'i01', undefined, 'fs', 'fsp', BackendType.orion],
            ['t01', 'i01', undefined, undefined, 'fsp', BackendType.orion],
            ['t01', 'i01', undefined, undefined, undefined, BackendType.orion],
          ])('', (type, id, qdid, fsa, fspa, backend) => {
            it(`${desc} data=${JSON.stringify(data)}, QueueDef(type=${type}, id=${qdid}, fiwareServcie=${fsa}, fiwareServciePath=${fspa}, backend=${backend})`, (done) => {
              jest.isolateModules(() => {
                if (iotaCbHost !== null) process.env.IOTA_CB_HOST = iotaCbHost;
                if (iotaCbPort !== null) process.env.IOTA_CB_PORT = iotaCbPort;
                if (iotaCbNgsiVersion !== null) process.env.IOTA_CB_NGSI_VERSION = iotaCbNgsiVersion;
                if (fiwareService !== null) process.env.FIWARE_SERVICE = fiwareService;
                if (fiwareServicePath !== null) process.env.FIWARE_SERVICEPATH = fiwareServicePath;

                if (isNew) {
                  getMock.mockResolvedValue({ status: 404 });
                  if (isResolved) {
                    postMock.mockResolvedValue({ status: 201 });
                  } else {
                    postMock.mockRejectedValue(new Error('rejected'));
                  }
                } else {
                  getMock.mockResolvedValue({ status: 200 });
                  if (isResolved) {
                    patchMock.mockResolvedValue({ status: 204 });
                  } else {
                    patchMock.mockRejectedValue(new Error('rejected'));
                  }
                }
                orion = require('@/bindings/orion');
              });
              const queueDef = new QueueDef(type, qdid, fsa, fspa, backend);
              orion.sendNgsiMessage(queueDef, data)
                .then((status: number) => {
                  if (!isResolved) done.fail();
                  expect(status).toBe(isNew ? 201 : 204);
                })
                .catch(() => {
                  if (isResolved) done.fail();
                })
                .finally(() => {
                  const getUrl = `http://${(iotaCbHost) ? iotaCbHost : 'localhost'}:${(iotaCbPort) ? iotaCbPort : '1026'}/${(iotaCbNgsiVersion) ? iotaCbNgsiVersion: 'v2'}/entities/urn:ngsi-ld:t01:i01`;
                  expect(getMock).toHaveBeenCalled();
                  expect(getMock.mock.calls[0][0]).toBe(getUrl);
                  expect(getMock.mock.calls[0][1]).toMatchObject({
                    params: {
                      type: 't01',
                    },
                    headers: {
                      'Fiware-Service': (fsa) ? fsa: (fiwareService) ? fiwareService : '',
                      'Fiware-ServicePath': (fspa) ? fspa : (fiwareServicePath) ? fiwareServicePath : '/'
                    }
                  });
                  if (isNew) {
                    expect(postMock).toHaveBeenCalledTimes(1);
                    const url = `http://${(iotaCbHost) ? iotaCbHost : 'localhost'}:${(iotaCbPort) ? iotaCbPort : '1026'}/${(iotaCbNgsiVersion) ? iotaCbNgsiVersion: 'v2'}/entities`;
                    expect(postMock.mock.calls[0][0]).toBe(url);
                    expect(postMock.mock.calls[0][1]).toMatchObject({
                      id: `urn:ngsi-ld:${type}:${id}`,
                      type: type,
                      temperature: { type: 'Number', value: 25.1 }
                    });
                    expect(postMock.mock.calls[0][2]).toMatchObject({
                      headers: {
                        'Fiware-Service': (fsa) ? fsa: (fiwareService) ? fiwareService : '',
                        'Fiware-ServicePath': (fspa) ? fspa : (fiwareServicePath) ? fiwareServicePath : '/',
                        'Content-Type': 'application/json',
                      }
                    });
                  } else {
                    expect(patchMock).toHaveBeenCalledTimes(1);
                    const url = `http://${(iotaCbHost) ? iotaCbHost : 'localhost'}:${(iotaCbPort) ? iotaCbPort : '1026'}/${(iotaCbNgsiVersion) ? iotaCbNgsiVersion: 'v2'}/entities/urn:ngsi-ld:t01:i01/attrs`;
                    expect(patchMock.mock.calls[0][0]).toBe(url);
                    expect(patchMock.mock.calls[0][1]).toMatchObject({
                      temperature: { type: 'Number', value: 25.1 }
                    });
                    expect(patchMock.mock.calls[0][2]).toMatchObject({
                      headers: {
                        'Fiware-Service': (fsa) ? fsa: (fiwareService) ? fiwareService : '',
                        'Fiware-ServicePath': (fspa) ? fspa : (fiwareServicePath) ? fiwareServicePath : '/',
                        'Content-Type': 'application/json',
                      }
                    });
                  }
                  done();
                });
            });
          });
        });
      });
    });
  });
});
