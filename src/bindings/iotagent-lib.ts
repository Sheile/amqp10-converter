import * as iotagentLib from 'iotagent-node-lib';
import log4js from 'log4js';
import { getServices, getDevices } from '@/bindings/iotagent-json';
import { QueueDef, Entity, JsonType, JsonObject, ServiceType, DeviceType, isObject } from '@/common';

const host = process.env.IOTA_CB_HOST || 'localhost';
const port = process.env.IOTA_CB_PORT || '1026';
const iotagentHost = process.env.IOTA_HOST || 'localhost';
const iotagentManagePort = process.env.IOTA_MANAGE_PORT || '4041';
const ngsiVersion = process.env.IOTA_CB_NGSI_VERSION || 'v2';
const COMMAND_STATUS_COMPLETED = 'OK';
const idAttrName = process.env.ID_ATTR_NAME || '__id';

const logger = log4js.getLogger('iotagent-lib');

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
  iotagentLib.activate(config, (err?: unknown | undefined) => {
    if (!err) {
      logger.info('activated iotagent-node-lib');
    } else {
      logger.error('faild activating iotagent-node-lib', err);
      throw err;
    }
  });
}

const serviceCache: { [type: string]: ServiceType } = {};
const getService = async (queueDef: QueueDef, entity: Entity): Promise<ServiceType> => {
  if (!serviceCache[entity.type]) {
    const services = await getServices(queueDef);
    const found = services.find((s) => s.entity_type === entity.type);
    if (!found) {
      throw new Error('no service found');
    }
    serviceCache[entity.type] = found;
  }
  return serviceCache[entity.type];
}

const deviceCache: { [type: string]: { [id: string]: DeviceType } } = {};
const getDevice = async (queueDef: QueueDef, entity: Entity): Promise<DeviceType> => {
  if (!deviceCache[entity.type]) {
    deviceCache[entity.type] = {};
  }
  if (!deviceCache[entity.type][entity.id]) {
    const devices = await getDevices(queueDef);
    const found = devices.find((d) => d.entity_type === entity.type && d.entity_name === entity.id);
    if (!found) {
      throw new Error('no device found');
    }
    deviceCache[entity.type][entity.id] = found;
  }
  return deviceCache[entity.type][entity.id];
}

export const setCommandResult = async (queueDef: QueueDef, entity: Entity, data: JsonType | undefined): Promise<void> => {
  if (isObject(data) && !Array.isArray(data)) {
    const service = await getService(queueDef, entity);
    const device = await getDevice(queueDef, entity);
    const cmdName = Object.keys(data as JsonObject).filter(o => o !== idAttrName)[0];
    const cmdResult = (data as JsonObject)[cmdName];
    if (!(cmdName && cmdResult)) {
      throw new Error('empty data');
    }
    iotagentLib.setCommandResult(device.entity_name, service.resource, service.apikey, cmdName, cmdResult, COMMAND_STATUS_COMPLETED, {
      type: entity.type,
      id: entity.id,
      service: service.service,
      subservice: service.subservice,
      commands: device.commands,
    }, (err?: unknown | undefined) => {
      if (!err) {
        logger.debug('called setCommandResult successfully');
      } else {
        logger.error('failed calling setCommandResult', err);
        throw err;
      }
    });
  } else {
    throw new Error('no data found');
  }
}

export const deactivate = async (): Promise<void> => {
  iotagentLib.deactivate((err?: unknown | undefined) => {
    if (!err) {
      logger.info('deactivated iotagent-node-lib')
    } else {
      logger.error('failed deactivating iotagent-node-lib', err);
      throw err;
    }
  });
}