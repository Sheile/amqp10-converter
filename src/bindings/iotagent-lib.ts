import { getServices, getDevices } from '@/bindings/iotagent-json';
import { Entity, JsonType, JsonObject, ServiceType, DeviceType } from '@/common';
import * as iotagentLib from 'iotagent-node-lib';

const host = process.env.IOTA_CB_HOST || 'localhost';
const port = process.env.IOTA_CB_PORT || '1026';
const iotagentHost = process.env.IOTA_HOST || 'localhost';
const iotagentManagePort = process.env.IOTA_MANAGE_PORT || '4041';
const ngsiVersion = process.env.IOTA_CB_NGSI_VERSION || 'v2';
const COMMAND_STATUS_COMPLETED = 'OK';

const config: iotagentLib.Config = {
  logLevel: 'INFO',
  timestamp: true,
  contextBroker: {
    host: host,
    port: port,
    ngsiVersion: ngsiVersion,
  },
  deviceRegistry: {
    type: 'memory',
  },
  types: {},
  providerUrl: `http://${iotagentHost}:${iotagentManagePort}`,
};

export const activate = async (): Promise<void> => {
  iotagentLib.activate(config, (err: unknown | undefined) => {
    if (err) {
      console.error('faild activating iotagent-node-lib', err);
      Promise.reject(err);
    } else {
      Promise.resolve();
    }
  });
}

const serviceCache: { [type: string]: ServiceType } = {};
const getService = async (entity: Entity): Promise<ServiceType> => {
  if (!serviceCache[entity.type]) {
    const services = await getServices();
    const found = services.find((s) => s.entity_type === entity.type);
    if (!found) {
      throw new Error('no service found');
    }
    serviceCache[entity.type] = found;
  }
  return serviceCache[entity.type];
}

const deviceCache: { [type: string]: { [id: string]: DeviceType } } = {};
const getDevice = async (entity: Entity): Promise<DeviceType> => {
  if (!deviceCache[entity.type]) {
    deviceCache[entity.type] = {};
  }
  if (!deviceCache[entity.type][entity.id]) {
    const devices = await getDevices();
    const found = devices.find((d) => d.entity_type === entity.type && d.entity_name === entity.id);
    if (!found) {
      throw new Error('no device found');
    }
    deviceCache[entity.type][entity.id] = found;
  }
  return deviceCache[entity.type][entity.id];
}

export const setCommandResult = async (entity: Entity, data: JsonType | undefined): Promise<void> => {
  if (data) {
    const service = await getService(entity);
    const device = await getDevice(entity);
    const cmdName = Object.keys(data)[0];
    const cmdResult = (data as JsonObject)[cmdName];
    iotagentLib.setCommandResult(device.entity_name, service.resource, service.apikey, cmdName, cmdResult, COMMAND_STATUS_COMPLETED, {
      type: entity.type,
      id: entity.id,
      service: service.service,
      subservice: service.subservice,
      commands: device.commands,
    }, () => {
      Promise.resolve();
    });
  } else {
    Promise.reject('no data found');
  }
}