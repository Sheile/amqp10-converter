import axios from 'axios';
import { QueueDef, Entity, JsonType, ServiceType, DeviceType } from '@/common';

const iotagentHost = process.env.IOTA_HOST || 'localhost';
const iotagentDataPort = parseInt(process.env.IOTA_DATA_PORT || '7896');
const iotagentManagePort = process.env.IOTA_MANAGE_PORT || '4041';
const fiwareService = process.env.FIWARE_SERVICE || '';
const fiwareServicePath = process.env.FIWARE_SERVICEPATH || '/';

export const sendAttributes = async (queueDef: QueueDef, entity: Entity, data?: JsonType | undefined): Promise<number> => {
  const url = `http://${iotagentHost}:${iotagentDataPort}/iot/json?k=${entity.type}&i=${entity.id}`;
  const headers = {
    "Fiware-Service": queueDef.fiwareService ? queueDef.fiwareService : fiwareService,
    "Fiware-ServicePath": queueDef.fiwareServicePath ? queueDef.fiwareServicePath : fiwareServicePath,
    "Content-Type": "application/json",
  };
  const response = await axios.post(url, data, {headers: headers});
  return response.status;
};

export const getServices = async (queueDef: QueueDef): Promise<ServiceType[]> => {
  const url = `http://${iotagentHost}:${iotagentManagePort}/iot/services`;
  const headers = {
    "Fiware-Service": queueDef.fiwareService ? queueDef.fiwareService : fiwareService,
    "Fiware-ServicePath": queueDef.fiwareServicePath ? queueDef.fiwareServicePath : fiwareServicePath,
  };
  const response = await axios.get(url, {headers: headers});
  if (response.data.services && Array.isArray(response.data.services)) {
    return response.data.services.map((s: ServiceType) => s as ServiceType);
  } else {
    return [];
  }
}

export const getDevices = async (queueDef: QueueDef): Promise<DeviceType[]> => {
  const url = `http://${iotagentHost}:${iotagentManagePort}/iot/devices`;
  const headers = {
    "Fiware-Service": queueDef.fiwareService ? queueDef.fiwareService : fiwareService,
    "Fiware-ServicePath": queueDef.fiwareServicePath ? queueDef.fiwareServicePath : fiwareServicePath,
  };
  const response = await axios.get(url, {headers: headers});
  if (response.data.devices && Array.isArray(response.data.devices)) {
    return response.data.devices.map((s: DeviceType) => s as DeviceType);
  } else {
    return [];
  }
}