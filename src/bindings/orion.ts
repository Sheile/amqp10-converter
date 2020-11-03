import axios from 'axios';
import { QueueDef, JsonObject, ServiceType, DeviceType } from '@/common';

const orionHost = process.env.IOTA_CB_HOST || 'localhost';
const orionPort = parseInt(process.env.IOTA_CB_PORT || '1026');
const ngsiVersion = process.env.IOTA_CB_NGSI_VERSION || 'v2';
const fiwareService = process.env.FIWARE_SERVICE || '';
const fiwareServicePath = process.env.FIWARE_SERVICEPATH || '/';

export const sendNgsiMessage = async (queueDef: QueueDef, data: JsonObject): Promise<number> => {
  const headers = {
    "Fiware-Service": queueDef.fiwareService ? queueDef.fiwareService : fiwareService,
    "Fiware-ServicePath": queueDef.fiwareServicePath ? queueDef.fiwareServicePath : fiwareServicePath,
    "Content-Type": "application/json",
  };

  if (await existsEntity(queueDef, data)) {
    const url = `http://${orionHost}:${orionPort}/${ngsiVersion}/entities/${data.id}/attrs`;
    const {id, type, ...patchData} = data
    const response = await axios.patch(url, patchData, {headers: headers});
    return response.status;
  } else {
    const url = `http://${orionHost}:${orionPort}/${ngsiVersion}/entities`;
    const response = await axios.post(url, data, {headers: headers});
    return response.status;
  }
};


const existsEntity = async(queueDef: QueueDef, data: JsonObject): Promise<boolean> => {
  const url = `http://${orionHost}:${orionPort}/${ngsiVersion}/entities/${data.id}`;
  const headers = {
    "Fiware-Service": queueDef.fiwareService ? queueDef.fiwareService : fiwareService,
    "Fiware-ServicePath": queueDef.fiwareServicePath ? queueDef.fiwareServicePath : fiwareServicePath
  };

  const response = await axios.get(url, {params: {type: data.type}, headers: headers});
  return response.status === 200
};
